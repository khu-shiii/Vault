import type { EventMapping } from "./engine";

/** Industry configurations. Applying one replaces the organization's custom mappings. */
export const PRESETS: Record<string, Record<string, EventMapping>> = {
  e_commerce: {
    order_placed: { intent: "purchase_completed", purpose: "order_confirmation" },
    checkout_payment_declined: { intent: "payment_failed", purpose: "payment_recovery", recoveredBy: "checkout_payment_succeeded" },
    support_callback_requested: { intent: "callback_requested", purpose: "callback" },
  },
  legal_tech: {
    contract_signed: { intent: "purchase_completed", purpose: "signature_confirmation" },
    signature_failed: { intent: "payment_failed", purpose: "signature_recovery", recoveredBy: "contract_signed" },
    counsel_callback_requested: { intent: "callback_requested", purpose: "legal_callback" },
  },
  healthcare: {
    appointment_booked: { intent: "purchase_completed", purpose: "appointment_confirmation" },
    copay_payment_failed: { intent: "payment_failed", purpose: "copay_recovery", recoveredBy: "copay_payment_received" },
    nurse_callback_requested: { intent: "callback_requested", purpose: "nurse_callback" },
  },
};