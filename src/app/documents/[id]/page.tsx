"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

interface Detail {
  document: { id: string; title: string; fileHash: string; merkleRoot: string; fileSize: number; blockCount: number; createdAt: string };
  chain: { isValid: boolean; brokenSeq?: number; reason?: string };
  auditLog: { seq: number; actionType: string; actorEmail: string | null; timestamp: string; currentHash: string }[];
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const fetched = useRef(false); // each load writes a VIEW audit entry, so avoid the dev double-fetch

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api<Detail>(`/api/documents/${params.id}`).then(setData).catch((e) => setError(e.message));
  }, [params.id]);

  if (error) return <main className="p-10 text-red-400" role="alert">{error}</main>;
  if (!data) return <main className="p-10 text-zinc-400">Loading…</main>;
  const { document: d, chain, auditLog } = data;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <Link href="/dashboard" className="text-sm text-zinc-400 underline">← Back</Link>
      <h1 className="text-2xl font-bold">{d.title}</h1>

      <div role="status" className={`p-3 rounded border ${chain.isValid ? "border-emerald-600 text-emerald-400" : "border-red-600 text-red-400"}`}>
        {chain.isValid
          ? `Audit chain intact (${auditLog.length} entries)`
          : `Audit chain BROKEN${chain.brokenSeq ? ` at entry #${chain.brokenSeq}` : ""}: ${chain.reason}`}
      </div>

      <dl className="text-sm font-mono space-y-1 break-all">
        <div>File hash: {d.fileHash}</div>
        <div>Merkle root: {d.merkleRoot}</div>
        <div>Blocks: {d.blockCount} · Size: {d.fileSize} bytes · Registered: {new Date(d.createdAt).toLocaleString()}</div>
      </dl>

      <table className="w-full text-left text-sm">
        <thead className="text-zinc-400"><tr><th className="py-2">#</th><th>Action</th><th>Actor</th><th>Time</th><th>Hash</th></tr></thead>
        <tbody>
          {auditLog.map((e) => (
            <tr key={e.seq} className="border-t border-zinc-800">
              <td className="py-2">{e.seq}</td>
              <td>{e.actionType}</td>
              <td>{e.actorEmail ?? "—"}</td>
              <td>{new Date(e.timestamp).toLocaleString()}</td>
              <td className="font-mono">{e.currentHash.slice(0, 12)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
