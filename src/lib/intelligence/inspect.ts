import { ApiError } from "../api";
import { db } from "../db";
import { getActionView, getDecisionView } from "./service";

export interface Frame {
  at: string;
  source: "sdk_client" | "synthetic_simulation" | "decision_engine" | "dispatch" | "audit_chain";
  label: string;
  detail: unknown;
}
const byTime = (a: Frame, b: Frame) => new Date(a.at).getTime() - new Date(b.at).getTime();

async function customerFrames(organizationId: string, customerId: string): Promise<Frame[]> {
  const [events, interactions, decisions] = await Promise.all([
    db.sdkEvent.findMany({ where: { organizationId, customerId }, orderBy: { occurredAt: "asc" }, take: 500 }),
    db.interactionEvent.findMany({ where: { organizationId, customerId }, orderBy: { occurredAt: "asc" }, take: 500 }),
    db.decision.findMany({ where: { organizationId, customerId }, include: { actions: { orderBy: { step: "asc" } } }, take: 100 }),
  ]);
  const frames: Frame[] = [];
  for (const e of events) {
    frames.push({ at: e.occurredAt.toISOString(), source: "sdk_client", label: `Event: ${e.eventName}`, detail: { eventId: e.eventId, properties: e.properties } });
  }
  for (const i of interactions) {
    frames.push({
      at: i.occurredAt.toISOString(), source: "synthetic_simulation", label: `Interaction: ${i.type}`,
      detail: { channel: i.channel, actionId: i.actionId, status: i.status, payload: i.payload },
    });
  }
  for (const d of decisions) {
    const reasonCodes = (d.evidence as { reasonCodes?: string[] }).reasonCodes ?? [];
    frames.push({
      at: d.createdAt.toISOString(), source: "decision_engine", label: `Decision: ${d.intent} (priority ${d.priority})`,
      detail: { decisionId: d.id, halted: d.halted, reasonCodes },
    });
    for (const a of d.actions) {
      frames.push({
        at: a.createdAt.toISOString(), source: "dispatch", label: `Action step ${a.step} via ${a.channel}: ${a.status}`,
        detail: { actionId: a.id, status: a.status, attempts: a.attempts, mock: a.mock, lastError: a.lastError },
      });
    }
  }
  return frames.sort(byTime);
}

/** Resolves a decision/trace id, action id, document id or customer id into a subject plus a replayable timeline. */
export async function inspect(organizationId: string, raw: string) {
  const q = raw.trim();
  if (!q || q.length > 128) throw new ApiError(400, "BAD_REQUEST", "q is required (max 128 characters)");

  const decision = await db.decision.findFirst({ where: { id: q, organizationId }, select: { id: true, customerId: true } });
  if (decision) {
    return { kind: "decision", subject: await getDecisionView(organizationId, decision.id), replay: await customerFrames(organizationId, decision.customerId) };
  }

  const action = await db.action.findFirst({ where: { id: q, organizationId }, include: { decision: { select: { customerId: true } } } });
  if (action) {
    return { kind: "action", subject: await getActionView(organizationId, action.id), replay: await customerFrames(organizationId, action.decision.customerId) };
  }

  const doc = await db.document.findFirst({
    where: { id: q, organizationId },
    select: { id: true, title: true, merkleRoot: true, fileHash: true, createdAt: true },
  });
  if (doc) {
    const entries = await db.auditLogEntry.findMany({
      where: { documentId: doc.id }, orderBy: { seq: "asc" }, include: { actor: { select: { email: true } } },
    });
    const replay: Frame[] = entries.map((e) => ({
      at: e.timestamp.toISOString(), source: "audit_chain" as const, label: `#${e.seq} ${e.actionType}`,
      detail: { actor: e.actor?.email ?? null, currentHash: e.currentHash },
    }));
    return { kind: "document", subject: doc, replay };
  }

  const customer = await db.customer.findFirst({ where: { organizationId, externalCustomerId: q } });
  if (customer) {
    const decisions = await db.decision.findMany({
      where: { organizationId, customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, intent: true, createdAt: true },
    });
    return {
      kind: "customer",
      subject: {
        externalCustomerId: customer.externalCustomerId, hasPhone: !!customer.phone, hasEmail: !!customer.email,
        consent: customer.consent, quietHours: customer.quietHours, decisions,
      },
      replay: await customerFrames(organizationId, customer.id),
    };
  }
  throw new ApiError(404, "NOT_FOUND", "Nothing matches that customer, document, decision or action ID");
}