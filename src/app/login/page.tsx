"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16 space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="email" type="email" placeholder="Email" required className="w-full p-2 rounded bg-zinc-900 border border-zinc-700" />
        <input name="password" type="password" placeholder="Password" required className="w-full p-2 rounded bg-zinc-900 border border-zinc-700" />
        <button className="w-full p-2 rounded bg-emerald-600 hover:bg-emerald-500">Sign in</button>
      </form>
      {error && <p role="alert" className="text-red-400">{error}</p>}
    </main>
  );
}
