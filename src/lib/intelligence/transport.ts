import { ApiError } from "../api";
import { CHANNELS, type Channel } from "./engine";

export interface CanonicalActionRequest {
  actionId: string;
  decisionId: string;
  externalCustomerId: string;
  channel: Channel;
  purpose: string;
  action: "send_message" | "send_email" | "place_call";
  recipient: { phone?: string; email?: string };
  content: { type: "template"; templateKey: string; parameters: Record<string, string | number | boolean> };
  reasonCodes: string[];
  idempotencyKey: string;
}
export interface TransportResult { actionId: string; status: "accepted"; mock: true }

/** Drop-in boundary: replace with a real provider adapter without touching decision rules. */
export interface TransportAdapter { send(req: CanonicalActionRequest): Promise<TransportResult> }

const ACTIONS = ["send_message", "send_email", "place_call"];

export function validateCanonical(x: unknown): CanonicalActionRequest {
  const bad = (m: string) => new ApiError(400, "BAD_REQUEST", m);
  if (!x || typeof x !== "object" || Array.isArray(x)) throw bad("Body must be an object");
  const r = x as Record<string, unknown>;
  for (const k of ["actionId", "decisionId", "externalCustomerId", "purpose", "idempotencyKey"]) {
    if (typeof r[k] !== "string" || !r[k]) throw bad(`${k} is required`);
  }
  if (!CHANNELS.includes(r.channel as Channel)) throw bad("invalid channel");
  if (!ACTIONS.includes(r.action as string)) throw bad("invalid action");
  const rec = r.recipient as Record<string, unknown> | undefined;
  if (!rec || (typeof rec.phone !== "string" && typeof rec.email !== "string")) throw bad("recipient.phone or recipient.email is required");
  const c = r.content as Record<string, unknown> | undefined;
  if (!c || c.type !== "template" || typeof c.templateKey !== "string") throw bad("content.templateKey is required");
  if (!Array.isArray(r.reasonCodes)) throw bad("reasonCodes must be an array");
  return r as unknown as CanonicalActionRequest;
}

/** Accepts and acknowledges only. "accepted" is never delivery: delivery arrives via interaction events. */
export const mockTransport: TransportAdapter = {
  async send(req) {
    validateCanonical(req);
    return { actionId: req.actionId, status: "accepted", mock: true };
  },
};

let current: TransportAdapter = mockTransport;
export const getTransport = () => current;
export const setTransport = (t: TransportAdapter) => {
  current = t;
};