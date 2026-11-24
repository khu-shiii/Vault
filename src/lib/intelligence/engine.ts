export const CHANNELS = ["whatsapp", "email", "call"] as const;
export type Channel = (typeof CHANNELS)[number];
export const INTENTS = ["purchase_completed", "payment_failed", "callback_requested"] as const;
export type Intent = (typeof INTENTS)[number];

export interface EventMapping { intent: Intent; purpose: string; recoveredBy?: string }

/** Built-in mappings. Organizations extend/override these via PUT /v1/config/mappings (no code changes). */
export const DEFAULT_MAPPINGS: Record<string, EventMapping> = {
  purchase_completed: { intent: "purchase_completed", purpose: "order_confirmation" },
  payment_failed: { intent: "payment_failed", purpose: "payment_recovery", recoveredBy: "payment_recovered" },
  callback_requested: { intent: "callback_requested", purpose: "callback" },
  document_signature_failed: { intent: "payment_failed", purpose: "signature_recovery", recoveredBy: "document_signed" },
};

export interface QuietHours { start: string; end: string; utcOffsetMinutes?: number }
export interface CustomerCtx {
  phone: string | null;
  email: string | null;
  consent: Partial<Record<Channel, boolean>>;
  quietHours: QuietHours | null;
}
export interface PlanStep {
  step: number;
  channel: Channel;
  action: "send_message" | "send_email" | "place_call";
  purpose: string;
  templateKey: string;
  status: "eligible" | "deferred";
  dependsOnStep: number | null;
  notBefore: string | null;
  recipient: { phone?: string; email?: string };
  reasonCodes: string[];
}
export interface ExcludedStep { step: number; channel: Channel; reasonCodes: string[] }
export interface GateSummary { recipient: boolean; consent: boolean; quietHours: "clear" | "active" | "not_applicable" }
export interface DecisionResult {
  priority: number;
  halted: boolean;
  haltReason: string | null;
  steps: PlanStep[];
  excluded: ExcludedStep[];
  gates: Record<string, GateSummary>;
  reasonCodes: string[];
}

const PLANS: Record<Intent, { channel: Channel; conditional: boolean }[]> = {
  purchase_completed: [{ channel: "whatsapp", conditional: false }, { channel: "email", conditional: false }],
  payment_failed: [{ channel: "whatsapp", conditional: false }, { channel: "email", conditional: true }, { channel: "call", conditional: true }],
  callback_requested: [{ channel: "call", conditional: false }],
};
const PRIORITY: Record<Intent, number> = { payment_failed: 90, callback_requested: 80, purchase_completed: 40 };
const ACTION: Record<Channel, PlanStep["action"]> = { whatsapp: "send_message", email: "send_email", call: "place_call" };
const QUIET_CHANNELS: Channel[] = ["whatsapp", "call"];

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function quietWindow(now: Date, qh: QuietHours): { inWindow: false } | { inWindow: true; endsAt: Date } {
  const s = toMin(qh.start);
  const e = toMin(qh.end);
  if (s === e) return { inWindow: false };
  const local = new Date(now.getTime() + (qh.utcOffsetMinutes ?? 0) * 60000);
  const m = local.getUTCHours() * 60 + local.getUTCMinutes();
  const inWindow = s < e ? m >= s && m < e : m >= s || m < e;
  if (!inWindow) return { inWindow: false };
  let delta = e - m;
  if (delta <= 0) delta += 1440;
  const sub = local.getUTCSeconds() * 1000 + local.getUTCMilliseconds();
  return { inWindow: true, endsAt: new Date(now.getTime() + delta * 60000 - sub) };
}

export function evaluate(i: {
  intent: Intent;
  purpose: string;
  customer: CustomerCtx;
  now: Date;
  recovered: boolean;
}): DecisionResult {
  const base = [`INTENT_${i.intent.toUpperCase()}`];
  const result: DecisionResult = {
    priority: PRIORITY[i.intent], halted: false, haltReason: null, steps: [], excluded: [], gates: {}, reasonCodes: base,
  };
  if (i.recovered) {
    return { ...result, halted: true, haltReason: "HALTED_RECOVERED", reasonCodes: base.concat("HALTED_RECOVERED") };
  }

  const win = i.customer.quietHours ? quietWindow(i.now, i.customer.quietHours) : ({ inWindow: false } as const);
  const plan = PLANS[i.intent];
  let previousIncluded: number | null = null;

  for (let idx = 0; idx < plan.length; idx++) {
    const c = plan[idx];
    const step = idx + 1;
    const recipientValue = c.channel === "email" ? i.customer.email : i.customer.phone;
    const hasRecipient = !!recipientValue;
    const consent = i.customer.consent[c.channel] === true;
    const quiet: GateSummary["quietHours"] = QUIET_CHANNELS.indexOf(c.channel) === -1 ? "not_applicable" : win.inWindow ? "active" : "clear";
    result.gates[c.channel] = { recipient: hasRecipient, consent, quietHours: quiet };

    const excluded: string[] = [];
    if (!hasRecipient) {
      excluded.push("EXCLUDED_NO_RECIPIENT");
      if (c.channel === "call") excluded.push("CALL_UNAVAILABLE");
    }
    if (!consent) excluded.push("EXCLUDED_NO_CONSENT");
    if (excluded.length > 0) {
      result.excluded.push({ step, channel: c.channel, reasonCodes: excluded });
      continue;
    }

    // A fallback step waits on the nearest earlier step that is actually being sent; if none, it becomes primary.
    const dependsOnStep = c.conditional ? previousIncluded : null;
    const reasonCodes = base.concat("RECIPIENT_READY", "CONSENT_VERIFIED");
    if (c.conditional) reasonCodes.push(dependsOnStep ? "FALLBACK_IF_PREVIOUS_FAILS" : "PROMOTED_TO_PRIMARY");

    let status: PlanStep["status"] = "eligible";
    let notBefore: string | null = null;
    if (quiet === "active" && win.inWindow) {
      status = "deferred";
      notBefore = win.endsAt.toISOString();
      reasonCodes.push("DEFERRED_QUIET_HOURS");
    }
    result.steps.push({
      step, channel: c.channel, action: ACTION[c.channel], purpose: i.purpose,
      templateKey: `${i.purpose}_${c.channel}`, status, dependsOnStep, notBefore,
      recipient: c.channel === "email" ? { email: recipientValue as string } : { phone: recipientValue as string },
      reasonCodes,
    });
    previousIncluded = step;
  }
  return result;
}