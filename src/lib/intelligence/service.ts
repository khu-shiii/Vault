import { randomUUID } from "crypto";
import { Prisma, type Action, type Decision } from "@prisma/client";
import { ApiError } from "../api";
import { db } from "../db";
import {
  CHANNELS, DEFAULT_MAPPINGS, INTENTS, evaluate,
  type Channel, type EventMapping, type Intent, type PlanStep, type QuietHours,
} from "./engine";
import { getTransport, type CanonicalActionRequest } from "./transport";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";
const json = (v: unknown) => v as Prisma.InputJsonValue;
const bad = (m: string) => new ApiError(400, "BAD_REQUEST", m);
const NAME_RE = /^[A-Za-z0-9_.:-]{1,100}$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function str(v: unknown, name: string, max = 128): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw bad(`${name} is required (max ${max} chars)`);
  return v.trim();
}

/** Tests/demos may pass `now`; ignored in production. */
export function parseNow(body: Record<string, unknown>): Date {
  if (process.env.NODE_ENV !== "production" && typeof body.now === "string" && !isNaN(Date.parse(body.now))) {
    return new Date(body.now);
  }
  return new Date();
}

// ---------- customers & identity ----------
async function getOrCreateCustomer(organizationId: string, externalCustomerId: string) {
  const where = { organizationId_externalCustomerId: { organizationId, externalCustomerId } };
  const found = await db.customer.findUnique({ where });
  if (found) return found;
  try {
    return await db.customer.create({ data: { organizationId, externalCustomerId } });
  } catch (e) {
    if (!isUnique(e)) throw e;
    return db.customer.findUniqueOrThrow({ where });
  }
}

function parseTraits(t: unknown) {
  const out: { phone?: string | null; email?: string | null; consent?: Partial<Record<Channel, boolean>>; quietHours?: QuietHours | null } = {};
  if (t === undefined) return out;
  if (!isObj(t)) throw bad("traits must be an object");
  if (t.phone !== undefined) {
    if (t.phone !== null && (typeof t.phone !== "string" || !PHONE_RE.test(t.phone))) throw bad("invalid phone");
    out.phone = t.phone as string | null;
  }
  if (t.email !== undefined) {
    if (t.email !== null && (typeof t.email !== "string" || t.email.length > 254 || !EMAIL_RE.test(t.email))) throw bad("invalid email");
    out.email = t.email as string | null;
  }
  if (t.consent !== undefined) {
    if (!isObj(t.consent)) throw bad("consent must be an object");
    const c: Partial<Record<Channel, boolean>> = {};
    for (const k of Object.keys(t.consent)) {
      if (!CHANNELS.includes(k as Channel) || typeof t.consent[k] !== "boolean") throw bad("consent keys must be whatsapp|email|call with boolean values");
      c[k as Channel] = t.consent[k] as boolean;
    }
    out.consent = c;
  }
  if (t.quietHours !== undefined) {
    const q = t.quietHours;
    if (q === null) out.quietHours = null;
    else {
      const off = isObj(q) && q.utcOffsetMinutes !== undefined ? q.utcOffsetMinutes : 0;
      if (!isObj(q) || typeof q.start !== "string" || typeof q.end !== "string" || !HHMM_RE.test(q.start) || !HHMM_RE.test(q.end) || q.start === q.end ||
          typeof off !== "number" || !Number.isInteger(off) || off < -720 || off > 840) {
        throw bad("quietHours must be {start:'HH:MM', end:'HH:MM', utcOffsetMinutes?}");
      }
      out.quietHours = { start: q.start, end: q.end, utcOffsetMinutes: off };
    }
  }
  return out;
}

export async function identify(organizationId: string, body: Record<string, unknown>) {
  const ext = str(body.externalCustomerId, "externalCustomerId");
  const anon = body.anonymousId === undefined ? undefined : str(body.anonymousId, "anonymousId");
  const traits = parseTraits(body.traits);
  const existing = await getOrCreateCustomer(organizationId, ext);

  const customer = await db.customer.update({
    where: { id: existing.id },
    data: {
      ...(traits.phone !== undefined && { phone: traits.phone }),
      ...(traits.email !== undefined && { email: traits.email }),
      ...(traits.consent && { consent: json({ ...(existing.consent as object), ...traits.consent }) }),
      ...(traits.quietHours !== undefined && { quietHours: traits.quietHours === null ? Prisma.JsonNull : json(traits.quietHours) }),
    },
  });

  let linkedEvents = 0;
  if (anon) {
    const bound = await db.anonymousIdentity.findUnique({ where: { organizationId_anonymousId: { organizationId, anonymousId: anon } } });
    if (bound && bound.customerId !== customer.id) throw new ApiError(409, "ANONYMOUS_ID_BOUND", "anonymousId is already linked to another customer");
    if (!bound) {
      try {
        await db.anonymousIdentity.create({ data: { organizationId, anonymousId: anon, customerId: customer.id } });
      } catch (e) {
        if (!isUnique(e)) throw e;
      }
    }
    linkedEvents = (
      await db.sdkEvent.updateMany({
        where: { organizationId, anonymousId: anon, customerId: null },
        data: { customerId: customer.id, externalCustomerId: ext },
      })
    ).count;
  }
  return { customerId: customer.id, externalCustomerId: ext, linkedEvents };
}

// ---------- event intake ----------
interface ParsedEvent {
  eventId: string; externalCustomerId?: string; anonymousId?: string; eventName: string;
  occurredAt: Date; source: string; schemaVersion: number; properties: Record<string, unknown>;
}

function parseEvent(x: unknown): { event: ParsedEvent } | { error: string } {
  if (!isObj(x)) return { error: "event must be an object" };
  if (typeof x.eventId !== "string" || !x.eventId || x.eventId.length > 128) return { error: "eventId is required" };
  if (typeof x.eventName !== "string" || !NAME_RE.test(x.eventName)) return { error: "invalid eventName" };
  const at = typeof x.occurredAt === "string" ? new Date(x.occurredAt) : null;
  if (!at || isNaN(at.getTime())) return { error: "occurredAt must be an ISO date" };
  if (x.schemaVersion !== 1) return { error: "UNSUPPORTED_SCHEMA_VERSION" };
  const ext = typeof x.externalCustomerId === "string" && x.externalCustomerId && x.externalCustomerId.length <= 128 ? x.externalCustomerId : undefined;
  const anon = typeof x.anonymousId === "string" && x.anonymousId && x.anonymousId.length <= 128 ? x.anonymousId : undefined;
  if (!ext && !anon) return { error: "externalCustomerId or anonymousId is required" };
  const properties = x.properties === undefined ? {} : x.properties;
  if (!isObj(properties) || JSON.stringify(properties).length > 8192) return { error: "properties must be an object under 8 KB" };
  const source = typeof x.source === "string" && x.source.length <= 64 ? x.source : "sdk";
  return { event: { eventId: x.eventId, externalCustomerId: ext, anonymousId: anon, eventName: x.eventName, occurredAt: at, source, schemaVersion: 1, properties } };
}

export async function ingestEvents(organizationId: string, events: unknown[]) {
  const accepted: string[] = [];
  const duplicates: string[] = [];
  const rejected: string[] = [];
  const errors: { eventId: string; reason: string }[] = [];
  const seen = new Set<string>();
  const touched = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    const parsed = parseEvent(item);
    if ("error" in parsed) {
      const label = isObj(item) && typeof item.eventId === "string" ? item.eventId : `index-${i}`;
      rejected.push(label);
      errors.push({ eventId: label, reason: parsed.error });
      continue;
    }
    const e = parsed.event;
    if (seen.has(e.eventId)) { duplicates.push(e.eventId); continue; }
    seen.add(e.eventId);

    let customerId: string | null = null;
    let ext: string | null = e.externalCustomerId ?? null;
    if (ext) {
      customerId = (await getOrCreateCustomer(organizationId, ext)).id;
    } else if (e.anonymousId) {
      const m = await db.anonymousIdentity.findUnique({
        where: { organizationId_anonymousId: { organizationId, anonymousId: e.anonymousId } },
        include: { customer: true },
      });
      if (m) { customerId = m.customerId; ext = m.customer.externalCustomerId; }
    }
    try {
      await db.sdkEvent.create({
        data: {
          organizationId, eventId: e.eventId, customerId, externalCustomerId: ext, anonymousId: e.anonymousId ?? null,
          eventName: e.eventName, occurredAt: e.occurredAt, source: e.source, schemaVersion: e.schemaVersion, properties: json(e.properties),
        },
      });
      accepted.push(e.eventId);
      if (customerId) touched.add(customerId);
    } catch (err) {
      if (!isUnique(err)) throw err;
      duplicates.push(e.eventId);
    }
  }

  // New events can release or halt open follow-up steps (e.g. payment_recovered halts the fallback chain).
  const ids = Array.from(touched);
  for (let i = 0; i < ids.length; i++) {
    try { await advanceOpenDecisions(organizationId, ids[i]); } catch (err) { console.error("advance failed", err); }
  }
  return { accepted, duplicates, rejected, errors };
}

// ---------- mappings ----------
async function loadMappings(organizationId: string): Promise<Record<string, EventMapping>> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { eventMappings: true } });
  return { ...DEFAULT_MAPPINGS, ...((org?.eventMappings as unknown as Record<string, EventMapping>) ?? {}) };
}

export async function getMappings(organizationId: string) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { eventMappings: true } });
  return { defaults: DEFAULT_MAPPINGS, custom: org?.eventMappings ?? {} };
}

export async function setMappings(organizationId: string, body: Record<string, unknown>) {
  const m = body.mappings;
  if (!isObj(m) || Object.keys(m).length > 100) throw bad("mappings must be an object with at most 100 entries");
  const out: Record<string, EventMapping> = {};
  const names = Object.keys(m);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const v = m[name];
    if (!NAME_RE.test(name) || !isObj(v) || !INTENTS.includes(v.intent as Intent) || typeof v.purpose !== "string" || !v.purpose || v.purpose.length > 64) {
      throw bad(`invalid mapping for "${name}"`);
    }
    if (v.recoveredBy !== undefined && (typeof v.recoveredBy !== "string" || !NAME_RE.test(v.recoveredBy))) throw bad(`invalid recoveredBy for "${name}"`);
    out[name] = { intent: v.intent as Intent, purpose: v.purpose, ...(v.recoveredBy ? { recoveredBy: v.recoveredBy as string } : {}) };
  }
  await db.organization.update({ where: { id: organizationId }, data: { eventMappings: json(out) } });
  return { mappings: out };
}

// ---------- interactions ----------
function mapDelivery(type: string, status: string | null): "delivered" | "failed" | "timeout" | null {
  if (status === "delivered" || status === "failed" || status === "timeout") return status;
  if (type === "call_status" && status === "answered") return "delivered";
  if (type === "call_status" && status === "no_answer") return "failed";
  return null;
}

export async function recordInteraction(organizationId: string, body: Record<string, unknown>) {
  const ext = str(body.externalCustomerId, "externalCustomerId");
  const type = typeof body.type === "string" && NAME_RE.test(body.type) ? body.type : null;
  if (!type) throw bad("type is required");
  const now = parseNow(body);
  const customer = await db.customer.findUnique({ where: { organizationId_externalCustomerId: { organizationId, externalCustomerId: ext } } });
  if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found");

  const interactionId = body.interactionId === undefined ? null : str(body.interactionId, "interactionId");
  if (interactionId && (await db.interactionEvent.findFirst({ where: { organizationId, interactionId } }))) {
    return { recorded: false, duplicate: true };
  }
  const channel = body.channel === undefined ? null : CHANNELS.includes(body.channel as Channel) ? (body.channel as Channel) : (() => { throw bad("invalid channel"); })();
  const actionId = body.actionId === undefined ? null : str(body.actionId, "actionId");
  const status = body.status === undefined ? null : str(body.status, "status", 32);
  const payload = body.payload === undefined ? {} : body.payload;
  if (!isObj(payload) || JSON.stringify(payload).length > 8192) throw bad("payload must be an object under 8 KB");
  let occurredAt = now;
  if (body.occurredAt !== undefined) {
    const d = new Date(String(body.occurredAt));
    if (isNaN(d.getTime())) throw bad("occurredAt must be an ISO date");
    occurredAt = d;
  }
  if (type === "consent_change" && (!CHANNELS.includes(payload.channel as Channel) || typeof payload.granted !== "boolean")) {
    throw bad("consent_change needs payload {channel, granted:boolean}");
  }

  try {
    await db.interactionEvent.create({
      data: { organizationId, interactionId, customerId: customer.id, type, channel, actionId, status, payload: json(payload), occurredAt },
    });
  } catch (e) {
    if (isUnique(e)) return { recorded: false, duplicate: true };
    throw e;
  }

  const result: Record<string, unknown> = { recorded: true, duplicate: false };
  if (type === "consent_change") {
    await db.customer.update({
      where: { id: customer.id },
      data: { consent: json({ ...(customer.consent as object), [payload.channel as string]: payload.granted }) },
    });
  } else if (type === "delivery_status" || type === "call_status") {
    const outcome = mapDelivery(type, status);
    const action = actionId ? await db.action.findFirst({ where: { id: actionId, organizationId } }) : null;
    if (!outcome || !action) result.ignored = "unknown action or status";
    else if (action.status !== "accepted") result.ignored = `action is ${action.status}, not accepted`;
    else {
      await db.action.update({ where: { id: action.id }, data: { status: outcome } });
      result.actionStatus = outcome;
      await advance(action.decisionId, now);
    }
  }
  await advanceOpenDecisions(organizationId, customer.id, now);
  return result;
}

export async function getTimeline(organizationId: string, externalCustomerId: string) {
  const customer = await db.customer.findUnique({ where: { organizationId_externalCustomerId: { organizationId, externalCustomerId } } });
  if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found");
  const [events, interactions] = await Promise.all([
    db.sdkEvent.findMany({ where: { organizationId, customerId: customer.id }, orderBy: { occurredAt: "asc" }, take: 500 }),
    db.interactionEvent.findMany({ where: { organizationId, customerId: customer.id }, orderBy: { occurredAt: "asc" }, take: 500 }),
  ]);
  const items = events
    .map((e) => ({ origin: "sdk_client", id: e.eventId, name: e.eventName, occurredAt: e.occurredAt, source: e.source, details: e.properties as unknown }))
    .concat(
      interactions.map((i) => ({
        origin: "synthetic_simulation", id: i.interactionId ?? i.id, name: i.type, occurredAt: i.occurredAt, source: "synthetic",
        details: { channel: i.channel, actionId: i.actionId, status: i.status, ...(i.payload as object) } as unknown,
      }))
    )
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  return { externalCustomerId, items };
}

// ---------- decisions ----------
interface Evidence {
  triggerEventName: string; triggerOccurredAt: string; recoveredBy: string | null; recovered: boolean;
  evaluatedAt: string; reasonCodes: string[]; haltReason: string | null; parameters: Record<string, string | number | boolean>;
}

async function hasRecovered(organizationId: string, customerId: string, after: Date, name: string) {
  const [a, b] = await Promise.all([
    db.sdkEvent.count({ where: { organizationId, customerId, eventName: name, occurredAt: { gt: after } } }),
    db.interactionEvent.count({ where: { organizationId, customerId, type: name, occurredAt: { gt: after } } }),
  ]);
  return a + b > 0;
}

const actionView = (a: Action) => ({
  actionId: a.id, decisionId: a.decisionId, step: a.step, channel: a.channel, status: a.status, mock: a.mock,
  attempts: a.attempts, notBefore: a.notBefore, dependsOnStep: a.dependsOnStep, lastError: a.lastError, request: a.payload,
});

const decisionView = (d: Decision, actions: Action[]) => ({
  id: d.id, intent: d.intent, purpose: d.purpose, priority: d.priority, halted: d.halted, triggerEventName: d.triggerEventName,
  steps: d.plan, excluded: d.excluded, gates: d.gates, evidence: d.evidence, createdAt: d.createdAt, actions: actions.map(actionView),
});

export async function createDecision(organizationId: string, body: Record<string, unknown>) {
  const ext = str(body.externalCustomerId, "externalCustomerId");
  const now = parseNow(body);
  const customer = await db.customer.findUnique({ where: { organizationId_externalCustomerId: { organizationId, externalCustomerId: ext } } });
  if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found");

  const mappings = await loadMappings(organizationId);
  const trigger =
    typeof body.triggerEventId === "string"
      ? await db.sdkEvent.findFirst({ where: { organizationId, customerId: customer.id, eventId: body.triggerEventId } })
      : await db.sdkEvent.findFirst({
          where: { organizationId, customerId: customer.id, eventName: { in: Object.keys(mappings) } },
          orderBy: { occurredAt: "desc" },
        });
  if (!trigger) throw new ApiError(404, "NO_TRIGGER_EVENT", "No mappable event found for this customer");
  const mapping = mappings[trigger.eventName];
  if (!mapping) throw new ApiError(422, "UNMAPPED_EVENT", `No mapping for event "${trigger.eventName}"`);

  const find = () =>
    db.decision.findUnique({
      where: { organizationId_triggerEventId: { organizationId, triggerEventId: trigger.id } },
      include: { actions: { orderBy: { step: "asc" } } },
    });
  const existing = await find();
  if (existing) return { reused: true, decision: decisionView(existing, existing.actions) };

  const recoveredBy = mapping.recoveredBy ?? null;
  const recovered = recoveredBy ? await hasRecovered(organizationId, customer.id, trigger.occurredAt, recoveredBy) : false;
  const result = evaluate({
    intent: mapping.intent, purpose: mapping.purpose, now, recovered,
    customer: {
      phone: customer.phone, email: customer.email,
      consent: customer.consent as Partial<Record<Channel, boolean>>,
      quietHours: (customer.quietHours as QuietHours | null) ?? null,
    },
  });

  const parameters: Evidence["parameters"] = {};
  const props = trigger.properties as Record<string, unknown>;
  const keys = Object.keys(props).slice(0, 20);
  for (let i = 0; i < keys.length; i++) {
    const v = props[keys[i]];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") parameters[keys[i]] = v;
  }
  const evidence: Evidence = {
    triggerEventName: trigger.eventName, triggerOccurredAt: trigger.occurredAt.toISOString(), recoveredBy, recovered,
    evaluatedAt: now.toISOString(), reasonCodes: result.reasonCodes, haltReason: result.haltReason, parameters,
  };
  try {
    const d = await db.decision.create({
      data: {
        organizationId, customerId: customer.id, triggerEventId: trigger.id, triggerEventName: trigger.eventName,
        intent: mapping.intent, purpose: mapping.purpose, priority: result.priority, halted: result.halted,
        plan: json(result.steps), excluded: json(result.excluded), gates: json(result.gates), evidence: json(evidence),
      },
    });
    return { reused: false, decision: decisionView(d, []) };
  } catch (e) {
    if (!isUnique(e)) throw e;
    const again = await find();
    if (!again) throw e;
    return { reused: true, decision: decisionView(again, again.actions) };
  }
}

export async function getDecisionView(organizationId: string, id: string) {
  const d = await db.decision.findFirst({ where: { id, organizationId }, include: { actions: { orderBy: { step: "asc" } } } });
  if (!d) throw new ApiError(404, "NOT_FOUND", "Decision not found");
  return decisionView(d, d.actions);
}

export async function getActionView(organizationId: string, id: string) {
  const a = await db.action.findFirst({ where: { id, organizationId } });
  if (!a) throw new ApiError(404, "NOT_FOUND", "Action not found");
  return actionView(a);
}

// ---------- dispatch & progression ----------
async function send(a: Action): Promise<Action> {
  try {
    const res = await getTransport().send(a.payload as unknown as CanonicalActionRequest);
    return await db.action.update({ where: { id: a.id }, data: { status: res.status, attempts: { increment: 1 }, lastError: null } });
  } catch (e) {
    const attempts = a.attempts + 1;
    return db.action.update({
      where: { id: a.id },
      data: { attempts, lastError: String((e as Error).message).slice(0, 200), status: attempts >= 3 ? "failed" : a.status },
    });
  }
}

/** Sends every open step whose dependency failed (or has none) and whose notBefore has passed. Idempotent. */
export async function advance(decisionId: string, now: Date = new Date()): Promise<Action[]> {
  const d = await db.decision.findUnique({ where: { id: decisionId }, include: { actions: { orderBy: { step: "asc" } } } });
  if (!d) return [];
  const open = d.actions.filter((a) => a.status === "queued" || a.status === "deferred");
  if (open.length === 0) return d.actions;

  const ev = d.evidence as unknown as Evidence;
  if (ev.recoveredBy && (await hasRecovered(d.organizationId, d.customerId, new Date(ev.triggerOccurredAt), ev.recoveredBy))) {
    await db.action.updateMany({ where: { id: { in: open.map((a) => a.id) } }, data: { status: "halted", lastError: "HALTED_RECOVERED" } });
  } else {
    const byStep = new Map<number, Action>(d.actions.map((a) => [a.step, a] as [number, Action]));
    for (let i = 0; i < open.length; i++) {
      const a = open[i];
      const dep = a.dependsOnStep ? byStep.get(a.dependsOnStep) : undefined;
      if (dep && (dep.status === "delivered" || dep.status === "halted" || dep.status === "skipped")) {
        byStep.set(a.step, await db.action.update({ where: { id: a.id }, data: { status: "skipped", lastError: "FALLBACK_NOT_NEEDED" } }));
        continue;
      }
      const depReady = !dep || dep.status === "failed" || dep.status === "timeout";
      const timeReady = !a.notBefore || a.notBefore.getTime() <= now.getTime();
      if (depReady && timeReady) byStep.set(a.step, await send(a));
    }
  }
  return db.action.findMany({ where: { decisionId }, orderBy: { step: "asc" } });
}

export async function advanceOpenDecisions(organizationId: string, customerId: string, now: Date = new Date()) {
  const open = await db.decision.findMany({
    where: { organizationId, customerId, actions: { some: { status: { in: ["queued", "deferred"] } } } },
    select: { id: true },
  });
  for (let i = 0; i < open.length; i++) await advance(open[i].id, now);
}

export async function dispatchDecision(organizationId: string, decisionId: string, now: Date = new Date()) {
  const d = await db.decision.findFirst({ where: { id: decisionId, organizationId }, include: { customer: true } });
  if (!d) throw new ApiError(404, "NOT_FOUND", "Decision not found");
  const steps = d.halted ? [] : (d.plan as unknown as PlanStep[]);
  const ev = d.evidence as unknown as Evidence;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const key = `${d.id}:${s.channel}:${s.step}`;
    if (await db.action.findUnique({ where: { idempotencyKey: key } })) continue; // already created: no double dispatch
    const id = randomUUID();
    const request: CanonicalActionRequest = {
      actionId: id, decisionId: d.id, externalCustomerId: d.customer.externalCustomerId, channel: s.channel,
      purpose: s.purpose, action: s.action, recipient: s.recipient,
      content: { type: "template", templateKey: s.templateKey, parameters: ev.parameters }, reasonCodes: s.reasonCodes, idempotencyKey: key,
    };
    try {
      await db.action.create({
        data: {
          id, organizationId, decisionId: d.id, step: s.step, channel: s.channel, purpose: s.purpose, action: s.action,
          status: s.status === "deferred" ? "deferred" : "queued", dependsOnStep: s.dependsOnStep,
          notBefore: s.notBefore ? new Date(s.notBefore) : null, payload: json(request), idempotencyKey: key,
        },
      });
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  const actions = await advance(d.id, now);
  return { decisionId: d.id, mock: true, actions: actions.map(actionView) };
}