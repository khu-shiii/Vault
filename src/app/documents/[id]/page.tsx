"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { Badge, ActionBadge } from "@/components/Badge";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  LayersIcon,
  FileTextIcon,
  ClockIcon,
  LockIcon,
  AlertCircleIcon,
  LinkIcon,
  UserIcon,
} from "@/components/Icons";

interface Detail {
  document: {
    id: string;
    title: string;
    fileHash: string;
    merkleRoot: string;
    fileSize: number;
    mimeType?: string;
    blockCount: number;
    createdAt: string;
  };
  chain: {
    isValid: boolean;
    brokenSeq?: number;
    reason?: string;
  };
  auditLog: {
    seq: number;
    actionType: string;
    actorEmail: string | null;
    timestamp: string;
    previousHash?: string;
    currentHash: string;
    payload?: any;
  }[];
}

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const fetched = useRef(false); // each load writes a VIEW audit entry, so avoid the dev double-fetch

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api<Detail>(`/api/documents/${params.id}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div
            role="alert"
            className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircleIcon className="w-6 h-6 text-rose-600 flex-shrink-0" />
              <h2 className="text-lg font-bold">Failed to load document attestation</h2>
            </div>
            <p className="text-sm">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-800 font-semibold rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Back to Document Ledger
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
          <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
          <CardSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  const { document: d, chain, auditLog } = data;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors min-h-[44px]"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Document Ledger
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/verify?documentId=${encodeURIComponent(d.id)}`}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-xs transition-colors"
            >
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
              Verify Candidate File Against This Doc
            </Link>
          </div>
        </div>

        {/* Document Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Document Attestation
                </span>
                {d.mimeType && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                    {d.mimeType}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
                {d.title}
              </h1>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
              <p className="flex sm:justify-end items-center gap-1.5">
                <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                Registered:{" "}
                <span className="font-medium text-slate-700">
                  {new Date(d.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </p>
              <div className="flex sm:justify-end items-center gap-1.5 font-mono text-[11px] text-slate-400">
                <span>ID: {d.id}</span>
                <CopyButton text={d.id} title="Copy Document ID" />
              </div>
            </div>
          </div>

          {/* Cryptographic Chain Integrity Banner */}
          <div
            role="status"
            className={`p-4 sm:p-5 rounded-xl border flex items-start gap-4 transition-all ${
              chain.isValid
                ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg flex-shrink-0 ${
                chain.isValid
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
              }`}
            >
              {chain.isValid ? (
                <ShieldCheckIcon className="w-6 h-6" />
              ) : (
                <ShieldAlertIcon className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">
                  {chain.isValid
                    ? "Cryptographic Audit Chain Intact"
                    : "Cryptographic Audit Chain Tampered / Broken"}
                </h3>
                <Badge
                  variant={chain.isValid ? "emerald" : "rose"}
                  size="sm"
                  icon={chain.isValid ? "shield-check" : "shield-alert"}
                >
                  {chain.isValid ? "Verified Valid" : "Tamper Alert"}
                </Badge>
              </div>

              <p className="text-sm leading-relaxed opacity-90">
                {chain.isValid
                  ? `All ${auditLog.length} sequential hash entries verify against genesis hash and SHA-256 continuity.`
                  : `Audit chain integrity failed at sequence entry #${chain.brokenSeq}: ${chain.reason}. The hash chain has been broken.`}
              </p>
            </div>
          </div>
        </div>

        {/* Cryptographic Proof Specifications Grid */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <LayersIcon className="w-5 h-5 text-blue-600" />
            Cryptographic Fingerprint & Merkle Proofs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SHA-256 Content Hash */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    File SHA-256 Digest
                  </span>
                </div>
                <CopyButton text={d.fileHash} label="Copy Hash" />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-800 break-all select-all">
                {d.fileHash}
              </div>
              <p className="text-[11px] text-slate-500">
                Unique cryptographic fingerprint calculated from the full byte payload.
              </p>
            </div>

            {/* Merkle Root */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Merkle Tree Root
                  </span>
                </div>
                <CopyButton text={d.merkleRoot} label="Copy Root" />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-800 break-all select-all">
                {d.merkleRoot}
              </div>
              <p className="text-[11px] text-slate-500">
                Top-level cryptographic root synthesizing {d.blockCount} partition leaf blocks.
              </p>
            </div>
          </div>

          {/* Quick Technical Summary Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="border-r border-slate-100 last:border-none">
              <p className="text-xs text-slate-500 font-medium">Merkle Blocks</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{d.blockCount}</p>
            </div>
            <div className="border-r border-slate-100 last:border-none">
              <p className="text-xs text-slate-500 font-medium">Original File Size</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{formatFileSize(d.fileSize)}</p>
            </div>
            <div className="border-r border-slate-100 last:border-none">
              <p className="text-xs text-slate-500 font-medium">Persisted File Bytes</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">0 Bytes (RAM only)</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Audit Events</p>
              <p className="text-lg font-bold text-blue-600 mt-0.5">{auditLog.length}</p>
            </div>
          </div>
        </section>

        {/* Immutable Hash-Chained Audit Trail Section */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Immutable Audit Log Sequence ({auditLog.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Each entry cryptographically signs the preceding event's hash, forming an unalterable sequential chain.
            </p>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4 w-16">Seq</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Actor</th>
                  <th scope="col" className="py-3 px-4">Timestamp</th>
                  <th scope="col" className="py-3 px-4">Current Entry Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {auditLog.map((e) => (
                  <tr key={e.seq} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-500">
                      #{e.seq}
                    </td>
                    <td className="py-3.5 px-4">
                      <ActionBadge action={e.actionType} />
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {e.actorEmail ? (
                        <span className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          {e.actorEmail}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">System Automation</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[200px]" title={e.currentHash}>
                          {e.currentHash.slice(0, 14)}…{e.currentHash.slice(-8)}
                        </span>
                        <CopyButton text={e.currentHash} title="Copy entry hash" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card / Timeline View */}
          <div className="space-y-3 md:hidden">
            {auditLog.map((e) => (
              <div
                key={e.seq}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Seq #{e.seq}
                    </span>
                    <ActionBadge action={e.actionType} />
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{e.actorEmail ?? "System"}</span>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Sequential Hash
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                    <span className="truncate">
                      {e.currentHash.slice(0, 10)}…{e.currentHash.slice(-8)}
                    </span>
                    <CopyButton text={e.currentHash} title="Copy hash" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
