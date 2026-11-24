# Vault integration guide

## Authentication
Send `x-api-key: <key>` (or `Authorization: Bearer <key>`) on every `/v1/*` call. Create a key:
`npx tsx prisma/create-api-key.ts` (shown once; only its SHA-256 is stored). Admins can also use `POST /api/api-keys`.
Keys are scoped to one organization, so data from other organizations is never visible. Limit: 600 requests/min per organization.
Errors use `{ "success": false, "error": { "code", "message" } }`.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | /v1/identify | Bind `anonymousId` to `externalCustomerId`; set traits (phone, email, consent, quietHours) |
| POST | /v1/events/batch | 1-100 events. 202 `{ accepted, duplicates, rejected, errors }` |
| GET | /v1/events | Recent accepted events (dashboard feed) |
| POST | /v1/interaction-events | Synthetic interactions: `consent_change`, `delivery_status`, `call_status`, `reply` |
| GET | /v1/customers/:id/timeline | SDK events + interactions, origin-labelled |
| POST | /v1/decisions/evaluate | Evaluate the latest mappable event (or `triggerEventId`) |
| GET | /v1/decisions/:id | Plan, gates, excluded steps, evidence, action statuses |
| POST | /v1/decisions/:id/dispatch | Send eligible steps to the transport (idempotent) |
| POST | /v1/mock/actions | Mock transport receiver |
| GET | /v1/actions/:id | Action state |
| GET | /v1/inspect?q= | Look up customer, document, decision or action id and return a replayable timeline |
| GET/PUT | /v1/config/mappings | Event to intent mappings (PUT: admin session only) |

## Event envelope
```json
{ "eventId": "evt-1", "externalCustomerId": "cust_1", "anonymousId": "optional", "eventName": "payment_failed",
  "occurredAt": "2026-11-20T10:00:00Z", "source": "web_browser", "schemaVersion": 1, "properties": {} }
```
`eventId` is the idempotency key per organization: resubmitting returns 202 with the id under `duplicates`.
Events sent with only `anonymousId` are linked automatically once `identify` binds that id.

## Decision rules
Intents: `purchase_completed` (WhatsApp, email, independent), `payment_failed` (WhatsApp, then email, then call; each step is a
fallback for the previous one and is sent only after it fails or times out; halts on the mapped recovery event), `callback_requested` (call).
Gates, in order: recipient present, consent for that channel (missing consent = no consent), quiet hours (WhatsApp and call are deferred
to the end of the window; email is not).
Reason codes: `INTENT_*`, `RECIPIENT_READY`, `CONSENT_VERIFIED`, `FALLBACK_IF_PREVIOUS_FAILS`, `PROMOTED_TO_PRIMARY`,
`DEFERRED_QUIET_HOURS`, `EXCLUDED_NO_CONSENT`, `EXCLUDED_NO_RECIPIENT`, `CALL_UNAVAILABLE`, `HALTED_RECOVERED`.
Custom events: `PUT /v1/config/mappings` with `{ "mappings": { "loan_declined": { "intent": "payment_failed", "purpose": "loan_followup", "recoveredBy": "loan_paid" } } }`.

## Action statuses
`queued`, `deferred`, `accepted` (transport acknowledged, NOT delivered), `delivered`, `failed`, `timeout`, `halted`, `skipped`.
Delivery results arrive only via `POST /v1/interaction-events` (`delivery_status` or `call_status`). Every action and mock response carries `mock: true`.
Deferred and fallback steps are released when a dispatch, interaction or event arrives. There is no background timer yet.

## Replacing the mock transport
Implement `TransportAdapter` from `src/lib/intelligence/transport.ts`:
```ts
import { setTransport } from "@/lib/intelligence/transport";
setTransport({ async send(req) { /* call your provider with req (canonical action request) */ return { actionId: req.actionId, status: "accepted", mock: true } } });
```
Decision rules do not change. (Update the `mock` flag honestly when you use a real provider.)

## Browser SDK
```ts
import { createVault } from "@/sdk/client";
const vault = createVault({ endpoint: "https://your-vault-host", apiKey: "<key>" });
await vault.identify("cust_1", { phone: "+15550293841", consent: { whatsapp: true } });
vault.track("payment_failed", { orderId: "o1" });
await vault.flush();
```
The SDK batches (20 events or 5 s), retries network errors, 429 and 5xx with exponential backoff, and re-sends the same `eventId`s so retries never duplicate.
Do not ship a privileged key in a public page. Send consent from your server where possible.

## Local run
`docker compose up -d`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`. Test: `npm test`. API collection: `postman/vault-v1.postman_collection.json`.