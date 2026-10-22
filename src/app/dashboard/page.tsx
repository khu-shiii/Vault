"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

interface Doc { id: string; title: string; fileSize: number; merkleRoot: string; createdAt: string }
interface Me { email: string; role: string }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setUser((await api<{ user: Me }>("/api/auth/me")).user);
      setDocs((await api<{ documents: Doc[] }>("/api/documents")).documents);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      await api("/api/documents", { method: "POST", body: new FormData(form) });
      form.reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <div className="text-sm text-zinc-400 flex items-center gap-3">
          {user && <span>{user.email} ({user.role})</span>}
          <button onClick={logout} className="underline">Sign out</button>
        </div>
      </header>

      {user && user.role !== "VIEWER" && (
        <form onSubmit={onUpload} className="flex flex-wrap gap-2 items-center">
          <input name="file" type="file" required />
          <input name="title" placeholder="Title (optional)" className="p-2 rounded bg-zinc-900 border border-zinc-700" />
          <button disabled={busy} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
            {busy ? "Uploading…" : "Upload & attest"}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-red-400">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead className="text-zinc-400">
          <tr><th className="py-2">Title</th><th>Size</th><th>Merkle root</th><th>Created</th></tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-t border-zinc-800">
              <td className="py-2"><Link href={`/documents/${d.id}`} className="text-emerald-400 underline">{d.title}</Link></td>
              <td>{(d.fileSize / 1024).toFixed(1)} KB</td>
              <td className="font-mono">{d.merkleRoot.slice(0, 12)}…</td>
              <td>{new Date(d.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={4} className="py-4 text-zinc-500">No documents yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
