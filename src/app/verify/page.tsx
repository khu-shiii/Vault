"use client";
import { DragEvent, useState } from "react";

interface Result {
  authentic: boolean;
  document?: { title: string; registeredAt: string };
  closestMatch: null | {
    title: string; storedBlocks: number; candidateBlocks: number;
    tamperedBlocks: { index: number; byteStart: number | null; byteEnd: number | null }[];
  };
  computed: { fileHash: string; merkleRoot: string; blocks: number };
}

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setFile(e.dataTransfer.files[0] ?? null);
  }

  async function verify() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (documentId.trim()) fd.append("documentId", documentId.trim());
      const json = await (await fetch("/api/verify", { method: "POST", body: fd })).json();
      if (!json.success) throw new Error(json.error?.message ?? "Verification failed");
      setResult(json.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      <h1 className="text-2xl font-bold">Verify a document</h1>
      <p className="text-zinc-400 text-sm">The file is hashed and discarded. It is never stored.</p>

      <label onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
        className="block p-10 text-center border-2 border-dashed border-zinc-700 rounded cursor-pointer hover:border-emerald-600">
        {file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : "Drop a file here or click to choose"}
        <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>

      <input value={documentId} onChange={(e) => setDocumentId(e.target.value)}
        placeholder="Document ID (optional, helps locate tampering in small files)"
        className="w-full p-2 rounded bg-zinc-900 border border-zinc-700 text-sm" />

      <button onClick={verify} disabled={!file || busy} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">
        {busy ? "Verifying…" : "Verify"}
      </button>
      {error && <p role="alert" className="text-red-400">{error}</p>}

      {result && (
        <section role="status" className={`p-4 rounded border space-y-2 ${result.authentic ? "border-emerald-600" : "border-red-600"}`}>
          {result.authentic ? (
            <p className="text-emerald-400 font-semibold">
              Authentic: matches “{result.document?.title}”, registered {new Date(result.document!.registeredAt).toLocaleString()}
            </p>
          ) : (
            <>
              <p className="text-red-400 font-semibold">Not authentic: no registered document matches this file exactly.</p>
              {result.closestMatch ? (
                <div className="text-sm">
                  <p>Closest registered document: “{result.closestMatch.title}” ({result.closestMatch.storedBlocks} blocks, your file has {result.closestMatch.candidateBlocks}).</p>
                  <p>Changed blocks:</p>
                  <ul className="list-disc ml-6 font-mono">
                    {result.closestMatch.tamperedBlocks.map((b) => (
                      <li key={b.index}>block {b.index}{b.byteStart !== null ? ` (bytes ${b.byteStart}–${b.byteEnd})` : " (extra block)"}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No similar document found.</p>
              )}
            </>
          )}
          <p className="text-xs font-mono text-zinc-500 break-all">SHA-256: {result.computed.fileHash}<br />Merkle root: {result.computed.merkleRoot}</p>
        </section>
      )}
    </main>
  );
}
