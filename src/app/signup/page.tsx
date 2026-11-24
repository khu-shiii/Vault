"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { ShieldIcon, AlertCircleIcon, Spinner } from "@/components/Icons";

const input =
  "w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition";
const label = "block text-xs font-semibold uppercase tracking-wider text-slate-700";

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [organisationName, setOrganisationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisationName: organisationName.trim(), email: email.trim(), password }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-blue-400 shadow-md mb-2">
              <ShieldIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
            <p className="text-sm text-slate-500">Set up an organisation and start attesting documents.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
            {error && (
              <div role="alert" className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <AlertCircleIcon className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 leading-snug">{error}</div>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="org" className={label}>Organisation name</label>
                <input id="org" required minLength={2} maxLength={100} value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)} className={input} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className={label}>Work email</label>
                <input id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} className={input} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={label}>Password</label>
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                  required minLength={10} maxLength={128} value={password}
                  onChange={(e) => setPassword(e.target.value)} className={input} />
                <p className="text-xs text-slate-500">At least 10 characters.</p>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? (<><Spinner className="w-4 h-4 text-white" /> Creating…</>) : "Create account"}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">Sign in</Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}