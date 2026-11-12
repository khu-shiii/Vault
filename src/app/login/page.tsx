"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldIcon,
  LockIcon,
  AlertCircleIcon,
  Spinner,
  ArrowRightIcon,
} from "@/components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await refreshUser();
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Invalid authentication credentials.");
    } finally {
      setLoading(false);
    }
  }

  const fillDemoAdmin = () => {
    setEmail("admin@example.com");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-blue-400 shadow-md mb-2">
              <ShieldIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign In to Vault
            </h1>
            <p className="text-sm text-slate-500">
              Access the immutable attestation ledger and Merkle proofs.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-fadeIn"
              >
                <AlertCircleIcon className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 leading-snug">{error}</div>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium focus:outline-none"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 text-white" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <LockIcon className="w-4 h-4" />
                    Sign In
                    <ArrowRightIcon className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Helper */}
            <div className="pt-4 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 p-4 rounded-b-2xl border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">Test Account:</span>
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="text-blue-600 hover:text-blue-700 font-semibold underline decoration-dotted"
                >
                  Fill admin@example.com
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Credentials created during initial database seed. Default password is the seed key generated at startup.
              </p>
            </div>
          </div>

          {/* Quick link to public verify */}
          <div className="text-center">
            <p className="text-xs text-slate-500">
              Only need to verify an existing document?{" "}
              <Link
                href="/verify"
                className="font-semibold text-blue-600 hover:text-blue-700 underline"
              >
                Go to Public File Verifier →
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
