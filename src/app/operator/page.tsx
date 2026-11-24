"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { AlertCircleIcon, Spinner } from "@/components/Icons";
import { post, v1 } from "@/lib/v1-client";
import { PRESETS } from "@/lib/intelligence/presets";

type J = any;

const STEPS = ["Configure", "Capture", "Timeline", "Decide", "Dispatch", "Inspect"];
const card = "bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-4";
const input = "w-full p-2 rounded-lg border border-slate-300 bg-white text-sm";
const btn = "inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50";
const btn2 = "inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50";
const ORIGIN: Record<string, string> = {
  sdk_client: "SDK Client", synthetic_simulation: "Synthetic Simulation", decision_engine: "Decision Engine",
  dispatch: "Dispatch (mock)", audit_chain: "Audit Chain",
};

// ---------- small helpers ----------
function usePersisted(key: string, initial: string): [string, (v: string) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s !== null) setV(s); } catch { /* storage unavailable */ }
  }, [key]);
  const set = useCallback((x: string) => {
    setV(x);
    try { localStorage.setItem(key, x); } catch { /* ignore */ }
  }, [key]);
  return [v, set];
}

function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try { return await fn(); } catch (e) { setError((e as Error).message); return undefined; } finally { setBusy(false); }
  }
  return { busy, error, run };
}

const Err = ({ msg }: { msg: string }) =>
  msg ? (
    <p role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
      <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" /> {msg}
    </p>
  ) : null;

const Json = ({ data }: { data: unknown }) => (
  <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-72">{JSON.stringify(data, null, 2)}</pre>
);

const Mock = () => <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">MOCK</span>;

const Chip = ({ source }: { source: string }) => (
  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${source === "sdk_client" ? "bg-blue-100 text-blue-800" : source === "synthetic_simulation" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
    {ORIGIN[source] ?? source}
  </span>
);

const Spin = ({ on }: { on: boolean }) => (on ? <Spinner className="w-4 h-4" /> : null);

// ---------- page ----------
export default function OperatorPage() {
  const { user, loading } = useAuth();
  const [step, setStep] = usePersisted("op_step", "0");
  const [customer, setCustomer] = usePersisted("op_customer", "cust_demo_1");
  const [decisionId, setDecisionId] = usePersisted("op_decision", "");
  const idx = Math.min(5, Math.max(0, Number(step) || 0));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div role="note" className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">
          <strong>MOCK ENVIRONMENT.</strong> No real WhatsApp, email or call is ever sent. &ldquo;accepted&rdquo; means the mock transport acknowledged a
          request. It is never a delivery confirmation.
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-slate-500"><Spinner className="w-5 h-5" /> Loading…</p>
        ) : !user ? (
          <p role="alert" className="p-4 rounded-lg bg-white border border-slate-200">Please sign in to use the operator dashboard.</p>
        ) : (
          <>
            <div className="max-w-sm">
              <label htmlFor="op-customer" className="block text-sm font-medium text-slate-700 mb-1">Customer ID (shared by all steps)</label>
              <input id="op-customer" className={input} value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>

            <nav aria-label="Operator steps">
              <ol className="flex flex-wrap gap-2">
                {STEPS.map((s, i) => (
                  <li key={s}>
                    <button
                      onClick={() => setStep(String(i))}
                      aria-current={i === idx ? "step" : undefined}
                      className={`px-3 py-2 min-h-[40px] text-sm font-semibold rounded-lg border ${i === idx ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-300 hover:bg-slate-50"}`}
                    >
                      {i + 1}. {s}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            {idx === 0 && <Configure customer={customer} />}
            {idx === 1 && <Capture customer={customer} />}
            {idx === 2 && <Timeline customer={customer} />}
            {idx === 3 && <Decide customer={customer} setDecisionId={setDecisionId} next={() => setStep("4")} />}
            {idx === 4 && <Dispatch decisionId={decisionId} setDecisionId={setDecisionId} />}
            {idx === 5 && <Inspect customer={customer} decisionId={decisionId} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ---------- 1. Configure ----------
function Configure({ customer }: { customer: string }) {
  const t = useTask();
  const [maps, setMaps] = useState<J>(null);
  const [mockRes, setMockRes] = useState<J>(null);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ phone: "+15550293841", email: "demo@example.test", whatsapp: true, mail: true, call: true, quiet: false });

  const load = () => t.run(async () => setMaps(await v1("/v1/config/mappings")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const apply = (name: string) =>
    t.run(async () => {
      await v1("/v1/config/mappings", { method: "PUT", body: JSON.stringify({ mappings: PRESETS[name] }) });
      setMsg(`Preset "${name}" applied.`);
      await load();
    });

  const saveCustomer = () =>
    t.run(async () => {
      const r = await post("/v1/identify", {
        externalCustomerId: customer,
        traits: {
          phone: f.phone.trim() || null, email: f.email.trim() || null,
          consent: { whatsapp: f.whatsapp, email: f.mail, call: f.call },
          quietHours: f.quiet ? { start: "22:00", end: "08:00", utcOffsetMinutes: 0 } : null,
        },
      });
      setMsg(`Customer "${r.externalCustomerId}" saved.`);
    });

  const testMock = () =>
    t.run(async () =>
      setMockRes(
        await post("/v1/mock/actions", {
          actionId: `ui-test-${Date.now()}`, decisionId: "ui-test", externalCustomerId: customer, channel: "whatsapp", purpose: "connectivity_test",
          action: "send_message", recipient: { phone: "+15550293841" }, content: { type: "template", templateKey: "ping", parameters: {} },
          reasonCodes: ["UI_TEST"], idempotencyKey: `ui-test:${Date.now()}`,
        })
      )
    );

  return (
    <div className="space-y-4">
      <Err msg={t.error} />
      {msg && <p role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{msg}</p>}

      <section className={card}>
        <h2 className="text-lg font-bold">Industry mapping</h2>
        <p className="text-sm text-slate-500">Maps your domain events to the platform&apos;s three intents. Applying a preset needs an ADMIN account.</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((p) => (
            <button key={p} className={btn2} disabled={t.busy} onClick={() => apply(p)}>{p.replace("_", " ")}</button>
          ))}
        </div>
        {maps && (
          <div className="grid gap-4 md:grid-cols-2">
            <div><h3 className="text-sm font-semibold mb-1">Built-in</h3><Json data={maps.defaults} /></div>
            <div><h3 className="text-sm font-semibold mb-1">Custom (active)</h3><Json data={maps.custom} /></div>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Mock transport <Mock /></h2>
        <p className="text-sm text-slate-500">In-process adapter behind <code>POST /v1/mock/actions</code>. Replace it via the <code>TransportAdapter</code> interface.</p>
        <button className={btn2} disabled={t.busy} onClick={testMock}><Spin on={t.busy} /> Send test request</button>
        {mockRes && <Json data={mockRes} />}
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Demo customer: {customer}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="c-phone" className="text-sm font-medium">Phone</label><input id="c-phone" className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label htmlFor="c-email" className="text-sm font-medium">Email</label><input id="c-email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="font-medium mb-1">Consent</legend>
          {([["whatsapp", "WhatsApp"], ["mail", "Email"], ["call", "Phone call"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.quiet} onChange={(e) => setF({ ...f, quiet: e.target.checked })} /> Quiet hours 22:00 to 08:00 UTC
          </label>
        </fieldset>
        <button className={btn} disabled={t.busy || !customer.trim()} onClick={saveCustomer}><Spin on={t.busy} /> Save customer</button>
      </section>
    </div>
  );
}

// ---------- 2. Capture ----------
function Capture({ customer }: { customer: string }) {
  const t = useTask();
  const [name, setName] = useState("payment_failed");
  const [props, setProps] = useState('{"documentTitle":"Mutual_NDA_v2.pdf","attemptCount":2}');
  const [last, setLast] = useState<J>(null);
  const [lastEvent, setLastEvent] = usePersisted("op_last_event", "");
  const [feed, setFeed] = useState<J[]>([]);

  const refresh = useCallback(async () => {
    try { setFeed((await v1<J>("/v1/events?limit=30")).events); } catch { /* feed is best-effort */ }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  const send = (eventId: string) =>
    t.run(async () => {
      let properties: J;
      try { properties = JSON.parse(props); } catch { throw new Error("Properties must be valid JSON"); }
      const started = performance.now();
      const response = await post("/v1/events/batch", {
        events: [{ eventId, externalCustomerId: customer, eventName: name, occurredAt: new Date().toISOString(), source: "operator_dashboard", schemaVersion: 1, properties }],
      });
      setLast({ ms: Math.round(performance.now() - started), eventId, response });
      setLastEvent(eventId);
      refresh();
    });

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-lg font-bold">Send a test event</h2>
        <p className="text-sm text-slate-500">Uses the same <code>POST /v1/events/batch</code> contract as the SDK.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-name" className="text-sm font-medium">Event name</label>
            <input id="ev-name" list="ev-names" className={input} value={name} onChange={(e) => setName(e.target.value)} />
            <datalist id="ev-names">
              {["purchase_completed", "payment_failed", "payment_recovered", "callback_requested", "document_signature_failed", "document_signed"].map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="ev-props" className="text-sm font-medium">Properties (JSON)</label>
            <textarea id="ev-props" rows={2} className={`${input} font-mono`} value={props} onChange={(e) => setProps(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={t.busy || !customer.trim()} onClick={() => send(`ui-${Date.now()}`)}><Spin on={t.busy} /> Send event</button>
          <button className={btn2} disabled={t.busy || !lastEvent} onClick={() => send(lastEvent)}>Resend last (duplicate test)</button>
        </div>
        <Err msg={t.error} />
        {last && (
          <div role="status" className="space-y-2">
            <p className="text-sm">
              <strong>{last.eventId}</strong> · {last.ms} ms ·{" "}
              {last.response.accepted.length > 0 && <span className="text-emerald-700 font-semibold">accepted </span>}
              {last.response.duplicates.length > 0 && <span className="text-amber-700 font-semibold">duplicate </span>}
              {last.response.rejected.length > 0 && <span className="text-rose-700 font-semibold">rejected</span>}
            </p>
            <Json data={last.response} />
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Live event stream</h2>
        <p className="text-xs text-slate-500">Refreshes every 3 seconds. Shows accepted events only.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent events</caption>
            <thead className="text-slate-500"><tr><th scope="col" className="py-2">Event ID</th><th scope="col">Name</th><th scope="col">Customer</th><th scope="col">Source</th><th scope="col">Received</th></tr></thead>
            <tbody>
              {feed.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-500">No events yet.</td></tr>}
              {feed.map((e) => (
                <tr key={e.eventId} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{e.eventId}</td>
                  <td>{e.eventName}</td>
                  <td>{e.externalCustomerId ?? <em className="text-slate-400">anon {String(e.anonymousId).slice(0, 8)}</em>}</td>
                  <td>{e.source}</td>
                  <td>{new Date(e.receivedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- 3. Timeline ----------
function Timeline({ customer }: { customer: string }) {
  const t = useTask();
  const [items, setItems] = useState<J[] | null>(null);
  const [sim, setSim] = useState({ type: "consent_change", channel: "whatsapp", status: "revoked", actionId: "" });

  const load = useCallback(
    () => t.run(async () => setItems((await v1<J>(`/v1/customers/${encodeURIComponent(customer)}/timeline`)).items)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customer]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [customer]);

  const simulate = () =>
    t.run(async () => {
      const body: J = {
        externalCustomerId: customer, type: sim.type, channel: sim.channel, status: sim.status,
        interactionId: `ui-${Date.now()}`,
      };
      if (sim.type === "consent_change") body.payload = { channel: sim.channel, granted: sim.status === "granted" };
      if (sim.actionId.trim()) body.actionId = sim.actionId.trim();
      await post("/v1/interaction-events", body);
      await load();
    });

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-lg font-bold">Timeline for {customer}</h2>
        <Err msg={t.error} />
        {t.busy && !items && <p className="flex items-center gap-2 text-slate-500"><Spinner className="w-4 h-4" /> Loading…</p>}
        {items && items.length === 0 && <p className="text-sm text-slate-500">No activity for this customer yet.</p>}
        <ol className="space-y-2">
          {(items ?? []).map((i) => (
            <li key={`${i.origin}-${i.id}`} className="border border-slate-200 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Chip source={i.origin} /> <strong>{i.name}</strong>
                <span className="text-slate-400">{new Date(i.occurredAt).toLocaleString()}</span>
              </div>
              <details className="mt-1"><summary className="text-xs text-slate-500 cursor-pointer">Details</summary><Json data={i.details} /></details>
            </li>
          ))}
        </ol>
        <button className={btn2} onClick={load} disabled={t.busy}>Refresh</button>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Simulate a customer interaction <Chip source="synthetic_simulation" /></h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="s-type" className="text-sm font-medium">Type</label>
            <select id="s-type" className={input} value={sim.type} onChange={(e) => setSim({ ...sim, type: e.target.value, status: e.target.value === "consent_change" ? "revoked" : "delivered" })}>
              <option value="consent_change">consent_change</option><option value="delivery_status">delivery_status</option><option value="reply">reply</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-ch" className="text-sm font-medium">Channel</label>
            <select id="s-ch" className={input} value={sim.channel} onChange={(e) => setSim({ ...sim, channel: e.target.value })}>
              <option>whatsapp</option><option>email</option><option>call</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-st" className="text-sm font-medium">Status</label>
            <input id="s-st" className={input} value={sim.status} onChange={(e) => setSim({ ...sim, status: e.target.value })} placeholder="granted | revoked | delivered | failed" />
          </div>
          <div>
            <label htmlFor="s-ac" className="text-sm font-medium">Action ID (delivery only)</label>
            <input id="s-ac" className={input} value={sim.actionId} onChange={(e) => setSim({ ...sim, actionId: e.target.value })} />
          </div>
        </div>
        <button className={btn} disabled={t.busy} onClick={simulate}><Spin on={t.busy} /> Record interaction</button>
      </section>
    </div>
  );
}

// ---------- 4. Decide ----------
function Decide({ customer, setDecisionId, next }: { customer: string; setDecisionId: (v: string) => void; next: () => void }) {
  const t = useTask();
  const [nowLocal, setNowLocal] = useState("");
  const [d, setD] = useState<J>(null);

  const evaluate = () =>
    t.run(async () => {
      const body: J = { externalCustomerId: customer };
      if (nowLocal) body.now = new Date(nowLocal).toISOString();
      const res = await post("/v1/decisions/evaluate", body);
      setD(res);
      setDecisionId(res.id);
    });

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-lg font-bold">Evaluate the latest mappable event</h2>
        <div className="max-w-sm">
          <label htmlFor="d-now" className="text-sm font-medium">Simulated time (optional, development only)</label>
          <input id="d-now" type="datetime-local" className={input} value={nowLocal} onChange={(e) => setNowLocal(e.target.value)} />
        </div>
        <button className={btn} disabled={t.busy || !customer.trim()} onClick={evaluate}><Spin on={t.busy} /> Evaluate decision</button>
        <Err msg={t.error} />
      </section>

      {d && (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{d.intent}</h2>
            <span className="text-sm">priority <strong>{d.priority}</strong></span>
            <span className="text-sm text-slate-500">purpose: {d.purpose}</span>
            {d.reused && <span className="text-xs px-2 py-0.5 rounded bg-slate-100">reused existing decision</span>}
            {d.halted && <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800">HALTED</span>}
          </div>
          <p className="text-xs font-mono text-slate-500 break-all">decision id (trace id): {d.id}</p>

          <h3 className="font-semibold">Action plan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Planned steps</caption>
              <thead className="text-slate-500"><tr><th scope="col" className="py-1">Step</th><th scope="col">Channel</th><th scope="col">Status</th><th scope="col">Depends on</th><th scope="col">Not before</th><th scope="col">Reason codes</th></tr></thead>
              <tbody>
                {d.steps.length === 0 && <tr><td colSpan={6} className="py-3 text-slate-500">No eligible steps.</td></tr>}
                {d.steps.map((s: J) => (
                  <tr key={s.step} className="border-t border-slate-100 align-top">
                    <td className="py-2">{s.step}</td><td>{s.channel}</td><td>{s.status}</td>
                    <td>{s.dependsOnStep ? `step ${s.dependsOnStep} fails` : "none"}</td>
                    <td>{s.notBefore ? new Date(s.notBefore).toLocaleString() : "—"}</td>
                    <td className="font-mono text-xs">{s.reasonCodes.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold">Policy gates</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Policy gates per channel</caption>
              <thead className="text-slate-500"><tr><th scope="col" className="py-1">Channel</th><th scope="col">Recipient</th><th scope="col">Consent</th><th scope="col">Quiet hours</th></tr></thead>
              <tbody>
                {Object.keys(d.gates).map((c) => (
                  <tr key={c} className="border-t border-slate-100">
                    <td className="py-2">{c}</td>
                    <td>{d.gates[c].recipient ? "pass" : "FAIL"}</td>
                    <td>{d.gates[c].consent ? "pass" : "FAIL"}</td>
                    <td>{d.gates[c].quietHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold">Excluded candidates</h3>
          {d.excluded.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="text-sm list-disc ml-5">
              {d.excluded.map((x: J) => <li key={x.step}>step {x.step} ({x.channel}): <code>{x.reasonCodes.join(", ")}</code></li>)}
            </ul>
          )}

          <details><summary className="text-sm cursor-pointer font-semibold">Evidence</summary><Json data={d.evidence} /></details>
          <button className={btn} onClick={next}>Continue to Dispatch</button>
        </section>
      )}
    </div>
  );
}

// ---------- 5. Dispatch ----------
function Dispatch({ decisionId, setDecisionId }: { decisionId: string; setDecisionId: (v: string) => void }) {
  const t = useTask();
  const [d, setD] = useState<J>(null);

  const load = useCallback(
    () => t.run(async () => { if (decisionId.trim()) setD(await v1(`/v1/decisions/${encodeURIComponent(decisionId.trim())}`)); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decisionId]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [decisionId]);

  const dispatch = () =>
    t.run(async () => {
      await post(`/v1/decisions/${encodeURIComponent(decisionId.trim())}/dispatch`, {});
      setD(await v1(`/v1/decisions/${encodeURIComponent(decisionId.trim())}`));
    });

  const simulate = (a: J, status: string) =>
    t.run(async () => {
      await post("/v1/interaction-events", {
        externalCustomerId: a.request.externalCustomerId, type: "delivery_status", channel: a.channel, actionId: a.actionId, status,
        interactionId: `ui-${Date.now()}-${a.step}`,
      });
      setD(await v1(`/v1/decisions/${encodeURIComponent(decisionId.trim())}`));
    });

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-lg font-bold">Dispatch to the mock transport <Mock /></h2>
        <div className="max-w-xl">
          <label htmlFor="dp-id" className="text-sm font-medium">Decision ID</label>
          <input id="dp-id" className={`${input} font-mono`} value={decisionId} onChange={(e) => setDecisionId(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={t.busy || !decisionId.trim()} onClick={dispatch}><Spin on={t.busy} /> Dispatch eligible steps</button>
          <button className={btn2} disabled={t.busy || !decisionId.trim()} onClick={load}>Refresh status</button>
        </div>
        <p className="text-xs text-slate-500">Dispatching again is safe: each step has an idempotency key, so nothing is sent twice.</p>
        <Err msg={t.error} />
      </section>

      {d && d.actions.length === 0 && <p className="text-sm text-slate-500">No actions yet. Press &ldquo;Dispatch eligible steps&rdquo;.</p>}
      {d && d.actions.map((a: J) => (
        <section key={a.actionId} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">Step {a.step}: {a.channel}</h3>
            <span className="text-sm px-2 py-0.5 rounded bg-slate-100 font-semibold">{a.status}</span>
            {a.mock && <Mock />}
            <span className="text-xs text-slate-500">attempts {a.attempts}</span>
            {a.dependsOnStep && <span className="text-xs text-slate-500">fallback for step {a.dependsOnStep}</span>}
            {a.notBefore && <span className="text-xs text-slate-500">not before {new Date(a.notBefore).toLocaleString()}</span>}
          </div>
          {a.status === "accepted" && <p className="text-xs text-amber-800">Accepted by the mock transport. This is not a delivery confirmation.</p>}
          {a.lastError && <p className="text-xs text-slate-500">note: {a.lastError}</p>}
          <details><summary className="text-sm cursor-pointer font-semibold">Canonical action request (raw JSON)</summary><Json data={a.request} /></details>
          {a.status === "accepted" && (
            <div className="flex flex-wrap gap-2 items-center text-sm">
              Simulate outcome:
              {["delivered", "failed", "timeout"].map((s) => <button key={s} className={btn2} disabled={t.busy} onClick={() => simulate(a, s)}>{s}</button>)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------- 6. Inspect ----------
function Inspect({ customer, decisionId }: { customer: string; decisionId: string }) {
  const t = useTask();
  const [q, setQ] = usePersisted("op_q", "");
  const [res, setRes] = useState<J>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  };
  useEffect(() => stop, []);

  const search = (term: string) =>
    t.run(async () => {
      stop();
      const r = await v1<J>(`/v1/inspect?q=${encodeURIComponent(term.trim())}`);
      setRes(r);
      setShown(r.replay.length);
    });

  const play = () => {
    if (!res) return;
    stop();
    const total = res.replay.length;
    let n = 0;
    setShown(0);
    timer.current = setInterval(() => {
      n++;
      setShown(n);
      if (n >= total) stop();
    }, 700);
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-lg font-bold">Inspect</h2>
        <p className="text-sm text-slate-500">Search by customer ID, document ID, or trace ID (decision or action ID).</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="in-q" className="sr-only">Search</label>
          <input id="in-q" className={`${input} font-mono`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="cust_demo_1 or a UUID" />
          <button className={btn} disabled={t.busy || !q.trim()} onClick={() => search(q)}><Spin on={t.busy} /> Search</button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className={btn2} onClick={() => { setQ(customer); search(customer); }}>Current customer</button>
          <button className={btn2} disabled={!decisionId} onClick={() => { setQ(decisionId); search(decisionId); }}>Latest decision</button>
        </div>
        <Err msg={t.error} />
      </section>

      {res && (
        <section className={card}>
          <h3 className="font-bold">Result: {res.kind}</h3>
          <Json data={res.subject} />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">Scenario replay ({shown}/{res.replay.length})</h3>
            <button className={btn2} onClick={play} disabled={res.replay.length === 0}>Play</button>
            <button className={btn2} onClick={() => { stop(); setShown((n) => Math.max(0, n - 1)); }}>Back</button>
            <button className={btn2} onClick={() => { stop(); setShown((n) => Math.min(res.replay.length, n + 1)); }}>Next</button>
            <button className={btn2} onClick={() => { stop(); setShown(0); }}>Reset</button>
          </div>
          <ol className="space-y-2" aria-live="polite">
            {res.replay.slice(0, shown).map((f: J, i: number) => (
              <li key={i} className={`border rounded-lg p-3 ${i === shown - 1 ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip source={f.source} /> <strong>{f.label}</strong>
                  <span className="text-slate-400">{new Date(f.at).toLocaleString()}</span>
                </div>
                <details className="mt-1"><summary className="text-xs text-slate-500 cursor-pointer">Details</summary><Json data={f.detail} /></details>
              </li>
            ))}
            {shown === 0 && <li className="text-sm text-slate-500">Press Play or Next to step through the scenario.</li>}
          </ol>
        </section>
      )}
    </div>
  );
}