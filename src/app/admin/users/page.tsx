"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { RoleBadge } from "@/components/Badge";
import { AlertCircleIcon, CheckIcon, Spinner } from "@/components/Icons";

interface UserRow { id: string; email: string; role: string; disabledAt: string | null; createdAt: string }
interface EventRow {
  id: string; action: string; details: Record<string, unknown>; createdAt: string;
  actorEmail: string | null; targetEmail: string | null;
}

const ROLES = ["SIGNER", "VIEWER"];
const field = "w-full p-2 rounded-lg border border-slate-300 bg-white text-sm";
const btn = "px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50";

export default function AdminUsersPage() {
  const { user: me, loading: authLoading } = useAuth();
  const isAdmin = me?.role === "ADMIN";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [form, setForm] = useState({ email: "", password: "", role: "VIEWER" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const [u, e] = await Promise.all([
        api<{ users: UserRow[] }>("/api/users"),
        api<{ events: EventRow[] }>("/api/security-events"),
      ]);
      setUsers(u.users);
      setEvents(e.events);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else if (!authLoading) setLoading(false);
  }, [isAdmin, authLoading, load]);

  async function patch(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setNotice(okMsg);
      setResetFor(null);
      setResetPw("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      await api("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setNotice(`User ${form.email} created.`);
      setForm({ email: "", password: "", role: "VIEWER" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">User management</h1>
          <p className="text-sm text-slate-500">Create accounts, assign roles, reset passwords and disable access for your organization.</p>
        </header>

        <div aria-live="polite" className="space-y-2">
          {error && (
            <p role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {notice && (
            <p role="status" className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              <CheckIcon className="w-4 h-4 mt-0.5 shrink-0" /> {notice}
            </p>
          )}
        </div>

        {authLoading || (isAdmin && loading) ? (
          <p className="flex items-center gap-2 text-slate-500"><Spinner className="w-5 h-5" /> Loading…</p>
        ) : !isAdmin ? (
          <p role="alert" className="p-4 rounded-lg bg-white border border-slate-200 text-slate-700">
            Only administrators can manage users.
          </p>
        ) : (
          <>
            <form onSubmit={create} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div>
                <label htmlFor="nu-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input id="nu-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
              </div>
              <div>
                <label htmlFor="nu-pw" className="block text-sm font-medium text-slate-700 mb-1">Temporary password (min 10)</label>
                <input id="nu-pw" type="password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
              </div>
              <div>
                <label htmlFor="nu-role" className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select id="nu-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={field}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button disabled={creating} className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {creating && <Spinner className="w-4 h-4" />} Create user
              </button>
            </form>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Organization users</caption>
                <thead className="text-slate-500 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3">Email</th>
                    <th scope="col" className="px-4 py-3">Role</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-slate-500">No users yet.</td></tr>
                  )}
                  {users.map((u) => {
                    const self = u.id === me?.id;
                    const busy = busyId === u.id;
                    return (
                      <FragmentRow key={u.id}>
                        <tr className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{u.email}{self && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                          <td className="px-4 py-3">
                            <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.email}</label>
                            <select
                              id={`role-${u.id}`}
                              value={u.role}
                              disabled={self || busy}
                              onChange={(e) => patch(u.id, { role: e.target.value }, `Role for ${u.email} set to ${e.target.value}.`)}
                              className="p-1.5 rounded-md border border-slate-300 text-xs bg-white disabled:opacity-60"
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <span className="ml-2 align-middle"><RoleBadge role={u.role} /></span>
                          </td>
                          <td className="px-4 py-3">{u.disabledAt ? <span className="text-rose-700 font-medium">Disabled</span> : <span className="text-emerald-700 font-medium">Active</span>}</td>
                          <td className="px-4 py-3 flex flex-wrap gap-2">
                            <button className={btn} disabled={busy} onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setResetPw(""); }}>Reset password</button>
                            <button
                              className={btn}
                              disabled={self || busy}
                              onClick={() => patch(u.id, { disabled: !u.disabledAt }, u.disabledAt ? `${u.email} enabled.` : `${u.email} disabled and signed out.`)}
                            >
                              {u.disabledAt ? "Enable" : "Disable"}
                            </button>
                          </td>
                        </tr>
                        {resetFor === u.id && (
                          <tr className="bg-slate-50">
                            <td colSpan={4} className="px-4 py-3">
                              <form
                                onSubmit={(e) => { e.preventDefault(); patch(u.id, { password: resetPw }, `Password for ${u.email} reset. Their sessions were ended.`); }}
                                className="flex flex-col sm:flex-row gap-2 sm:items-end"
                              >
                                <div className="flex-1">
                                  <label htmlFor={`pw-${u.id}`} className="block text-xs font-medium text-slate-700 mb-1">New password for {u.email} (min 10)</label>
                                  <input id={`pw-${u.id}`} type="password" required minLength={10} maxLength={128} value={resetPw} onChange={(e) => setResetPw(e.target.value)} className={field} />
                                </div>
                                <button className={btn} disabled={busy}>Set password</button>
                              </form>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900">Recent security events</h2>
              <p className="text-xs text-slate-500">A plain activity log of admin actions. It is not hash-chained.</p>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">No events yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {events.map((ev) => (
                    <li key={ev.id} className="py-2 flex flex-wrap gap-x-3">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{ev.action}</span>
                      <span>{ev.actorEmail ?? "unknown"} → {ev.targetEmail ?? "unknown"}</span>
                      <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

// Groups a user row with its optional reset row so React keys stay valid inside <tbody>.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}