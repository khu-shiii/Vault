"use client";

import { DragEvent, useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/Badge";
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  UploadCloudIcon,
  FileTextIcon,
  LayersIcon,
  AlertCircleIcon,
  Spinner,
  LockIcon,
  CheckIcon,
  XIcon,
  ArrowRightIcon,
} from "@/components/Icons";

interface Result {
  authentic: boolean;
  document?: { title: string; registeredAt: string };
  closestMatch: null | {
    title: string;
    storedBlocks: number;
    candidateBlocks: number;
    tamperedBlocks: { index: number; byteStart: number | null; byteEnd: number | null }[];
  };
  computed: { fileHash: string; merkleRoot: string; blocks: number };
}

function VerifyForm() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const docIdParam = searchParams.get("documentId");
    if (docIdParam) {
      setDocumentId(docIdParam);
    }
  }, [searchParams]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0] ?? null;
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError("");
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  async function verify() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (documentId.trim()) fd.append("documentId", documentId.trim());

      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Verification failed");
      setResult(json.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const resetAll = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-8">
      {/* Upload & Verification Input Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 ${
            isDragging
              ? "border-blue-600 bg-blue-50/60"
              : file
              ? "border-emerald-400 bg-emerald-50/20"
              : "border-slate-300 hover:border-blue-500 hover:bg-slate-50/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError("");
            }}
          />

          {file ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <FileTextIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-900 text-base sm:text-lg">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {formatFileSize(file.size)} • Candidate file selected
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetAll();
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline pt-2"
              >
                Change or remove file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-1">
                <UploadCloudIcon className="w-7 h-7" />
              </div>
              <p className="font-semibold text-slate-900 text-base">
                Drop your document here or{" "}
                <span className="text-blue-600 underline">browse computer</span>
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Any file type supported. The file is digested in memory to compute its SHA-256 Merkle tree and immediately discarded.
              </p>
            </div>
          )}
        </div>

        {/* Optional Document ID Parameter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="documentId"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Document ID (Optional)
            </label>
            <span className="text-[11px] text-slate-400">
              Helps locate byte-level tampering in small single-chunk files
            </span>
          </div>
          <div className="relative">
            <input
              id="documentId"
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="e.g. cm2v7x9… (Target Document ID)"
              className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
            {documentId && (
              <button
                type="button"
                onClick={() => setDocumentId("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear document ID"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={verify}
          disabled={!file || busy}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Spinner className="w-5 h-5 text-white" />
              Computing Merkle Proofs & Comparing Digests…
            </>
          ) : (
            <>
              <ShieldCheckIcon className="w-5 h-5" />
              Verify Document Integrity
            </>
          )}
        </button>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm shadow-xs animate-fadeIn"
          >
            <AlertCircleIcon className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button
              onClick={() => setError("")}
              className="p-1 text-rose-500 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Verification Result Display */}
      {result && (
        <section
          role="status"
          aria-live="polite"
          className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn"
        >
          {result.authentic ? (
            /* AUTHENTIC RESULT (Crisp Emerald Green) */
            <div className="p-6 rounded-xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <ShieldCheckIcon className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-emerald-900 tracking-tight">
                      Document Verified Authentic
                    </h3>
                    <Badge variant="emerald" size="sm" icon="check">
                      Cryptographically Valid
                    </Badge>
                  </div>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    This file exactly matches an attested record registered in the cryptographic ledger.
                  </p>
                </div>
              </div>

              {result.document && (
                <div className="bg-white/80 border border-emerald-200 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-slate-800">
                  <div className="flex justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500 font-medium">Matched Document:</span>
                    <span className="font-bold text-slate-900">{result.document.title}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500 font-medium">Attestation Timestamp:</span>
                    <span className="font-semibold text-slate-900">
                      {new Date(result.document.registeredAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* NOT AUTHENTIC / TAMPERED RESULT (Crimson/Amber) */
            <div className="p-6 rounded-xl bg-rose-50/90 border border-rose-300 text-rose-950 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <ShieldAlertIcon className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-rose-950 tracking-tight">
                      Verification Failed: Document Not Authentic
                    </h3>
                    <Badge variant="rose" size="sm" icon="shield-alert">
                      Tamper / Unregistered Alert
                    </Badge>
                  </div>
                  <p className="text-sm text-rose-800 leading-relaxed">
                    No registered document matches this candidate file's exact SHA-256 Merkle root.
                  </p>
                </div>
              </div>

              {/* Sub-block Tampering Diagnostic */}
              {result.closestMatch ? (
                <div className="bg-white border border-rose-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs uppercase font-bold tracking-wider text-rose-700">
                        Tampering Diagnostic Report
                      </h4>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        Closest Attested Document: “{result.closestMatch.title}”
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                      {result.closestMatch.tamperedBlocks.length} modified block(s)
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Merkle leaf chunk comparison revealed differences between the candidate file ({result.closestMatch.candidateBlocks} blocks) and the registered record ({result.closestMatch.storedBlocks} blocks).
                  </p>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Modified Byte Ranges:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {result.closestMatch.tamperedBlocks.map((b) => (
                        <div
                          key={b.index}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono"
                        >
                          <span className="font-bold text-rose-900">Block #{b.index}</span>
                          <span className="text-rose-700">
                            {b.byteStart !== null
                              ? `bytes ${b.byteStart.toLocaleString()}–${b.byteEnd?.toLocaleString()}`
                              : "extra block"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/80 border border-rose-200 rounded-lg p-4 text-xs text-slate-600">
                  <p>
                    No similar documents share matching Merkle leaves with this file. This file has either not been registered with Vault or is a completely distinct asset.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Computed Cryptographic Fingerprint */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <LayersIcon className="w-4 h-4 text-slate-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Computed Candidate Cryptographic Fingerprint
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Candidate SHA-256
                  </span>
                  <CopyButton text={result.computed.fileHash} />
                </div>
                <div className="font-mono text-xs text-slate-800 break-all select-all">
                  {result.computed.fileHash}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Candidate Merkle Root ({result.computed.blocks} blocks)
                  </span>
                  <CopyButton text={result.computed.merkleRoot} />
                </div>
                <div className="font-mono text-xs text-slate-800 break-all select-all">
                  {result.computed.merkleRoot}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
            Public Cryptographic Verification
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Verify Document Authenticity
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            Verify any candidate file against SHA-256 Merkle proofs without exposing sensitive document content.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 pt-1">
            <LockIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Zero-Knowledge: Files are processed in RAM and never stored.</span>
          </div>
        </div>

        {/* Verification Form wrapped in Suspense for useSearchParams */}
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center text-slate-400">
              <Spinner className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              Loading verification interface…
            </div>
          }
        >
          <VerifyForm />
        </Suspense>

        {/* Security Architecture Details */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-500">
          <div className="flex items-start gap-2.5">
            <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Chunk-Level Integrity:</span>{" "}
              Detects if even a single character or byte has changed.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Zero File Storage:</span> Original
              file bytes are never written to disk or sent to external servers.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Tamper Localization:</span> Pinpoints
              exact altered block ranges when matching against existing records.
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
