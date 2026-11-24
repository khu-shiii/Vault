"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { CopyButton } from "./CopyButton";
import { Spinner } from "./Icons";

interface Anchor { anchor: string; seq: number; issuedAt: string }

export function AnchorPanel({ documentId }: { documentId: string }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [saved, setSaved] = useState("");
  const [result, setResult] = useState<{ intact: boolean; seq: number } | null>(null);
  const [busy, setBusy] = useState<"get" | "check" | null>(null);
  const [error, setError] = useState("");

  async function getAnchor() {
    setBusy("get");
    setError("");
    try {
      setAnchor(await api<Anchor>(`/api/documents/${documentId}/anchor`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    setBusy("check");
    setError("");
    setResult(null);
    try {
      setResult(
        await api<{ intact: boolean; seq: number }>(`/api/documents/${documentId}/anchor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchor: saved.trim() }),
        })
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 space-y-4" aria-labelledby="anchor-title">
      <div>
        <h2 id="anchor-title" className="text-base font-bold text-slate-900">Chain anchor</h2>
        <p className="text-sm text-slate-500 mt-1">
          Save this value somewhere outside Vault (email it, print it, commit it to another system). If someone rewrites
          this document&apos;s history in the database, the saved value will no longer match.
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={getAnchor}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy === "get" && <Spinner className="w-4 h-4" />} Get current anchor
        </button>
        {anchor && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <code className="text-xs font-mono break-all flex-1">{anchor.anchor}</code>
            <CopyButton text={anchor.anchor} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="saved-anchor" className="block text-sm font-medium text-slate-700">Check a saved anchor</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="saved-anchor"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
            placeholder="3:ab12…(64 hex characters)"
            className="flex-1 p-2 rounded-lg border border-slate-300 text-sm font-mono"
          />
          <button
            onClick={check}
            disabled={!saved.trim() || busy !== null}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "check" && <Spinner className="w-4 h-4" />} Check
          </button>
        </div>
        {result && (
          <p role="status" className={`text-sm font-medium ${result.intact ? "text-emerald-700" : "text-rose-700"}`}>
            {result.intact
              ? `Entry #${result.seq} is still in the chain, unchanged.`
              : `Entry #${result.seq} does NOT match. The history may have been altered.`}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
    </section>
  );
}