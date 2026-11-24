"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { ShieldIcon, AlertCircleIcon, Spinner } from "@/components/Icons";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [orgName, setOrgName] = useState("");
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
        body: JSON.stringify({ orgName: orgName.trim(), email: email.trim(), password }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1.5 block w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-2 text-sm text-slate-600">Set up an organisation and start attesting documents.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 animate-fadeIn"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-slate-700">
                  Organisation name
                </label>
                <input
                  id="orgName"
                  name="orgName"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="organization"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={loading}
                  placeholder="Acme Legal LLP"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="you@company.com"
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}