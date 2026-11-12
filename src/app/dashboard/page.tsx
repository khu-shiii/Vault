"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Badge, RoleBadge } from "@/components/Badge";
import {
  FileTextIcon,
  UploadCloudIcon,
  ShieldCheckIcon,
  SearchIcon,
  Spinner,
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  LockIcon,
  XIcon,
} from "@/components/Icons";

interface Doc {
  id: string;
  title: string;
  fileSize: number;
  merkleRoot: string;
  createdAt: string;
  mimeType?: string;
  fileHash?: string;
}

interface Me {
  email: string;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Upload Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [meRes, docsRes] = await Promise.all([
        api<{ user: Me }>("/api/auth/me"),
        api<{ documents: Doc[] }>("/api/documents"),
      ]);
      setUser(meRes.user);
      setDocs(docsRes.documents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) return;

    setBusy(true);
    setError("");
    setSuccessMsg("");

    const fd = new FormData();
    fd.append("file", selectedFile);
    if (customTitle.trim()) {
      fd.append("title", customTitle.trim());
    }

    try {
      await api("/api/documents", { method: "POST", body: fd });
      setSelectedFile(null);
      setCustomTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccessMsg(`Document “${customTitle || selectedFile.name}” successfully attested.`);
      setTimeout(() => setSuccessMsg(""), 5000);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredDocs = docs.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.merkleRoot.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={user} onLogout={logout} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Document Ledger
              </h1>
              <Badge variant="emerald" size="sm" icon="shield-check">
                Audit Chain Active
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Cryptographically registered documents, Merkle trees, and tamper-evident audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-all min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
              Public Verifier
            </Link>
          </div>
        </div>

        {/* Status / Alert Messages */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm shadow-xs"
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

        {successMsg && (
          <div
            role="status"
            className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-xs"
          >
            <CheckIcon className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
            <button
              onClick={() => setSuccessMsg("")}
              className="p-1 text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss success message"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Registered Documents
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? "…" : docs.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <FileTextIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Merkle Trees Generated
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? "…" : docs.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <LayersIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Storage Model
              </p>
              <p className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Zero-Data Retention
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <LockIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Upload & Attest Section (For ADMIN or SIGNER) */}
        {user && user.role !== "VIEWER" && (
          <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloudIcon className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Attest & Register New Document
                </h2>
              </div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Zero plaintext persistence
              </span>
            </div>

            <form onSubmit={onUpload} className="p-6 space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setSelectedFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-150 ${
                  isDragging
                    ? "border-blue-600 bg-blue-50/50"
                    : selectedFile
                    ? "border-emerald-400 bg-emerald-50/20"
                    : "border-slate-300 hover:border-blue-500 hover:bg-slate-50/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  required
                  className="sr-only"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                      <FileTextIcon className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-900 text-base">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(selectedFile.size)}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-medium">Ready for attestation</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium pt-1 underline"
                    >
                      Remove and choose another file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                      <UploadCloudIcon className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-slate-800 text-sm">
                      <span className="text-blue-600 font-semibold underline">
                        Click to select a file
                      </span>{" "}
                      or drag and drop here
                    </p>
                    <p className="text-xs text-slate-500">
                      PDF, DOCX, TXT, JSON, or any binary asset (up to 20MB)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1">
                  <input
                    name="title"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Document Title (Optional, defaults to file name)"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedFile || busy}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {busy ? (
                    <>
                      <Spinner className="w-4 h-4 text-white" />
                      Computing Merkle Tree…
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="w-4 h-4" />
                      Upload & Attest
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                <LockIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>
                  <strong>Security Guarantee:</strong> File bytes are partitioned in RAM, hashed to generate Merkle leaves, and immediately discarded.
                </span>
              </p>
            </form>
          </section>
        )}

        {/* Ledger Document List Section */}
        <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Attested Documents ({filteredDocs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Click any document to inspect cryptographic leaves and hash-chain sequence.
              </p>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-72">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or hash…"
                className="w-full pl-9 pr-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 text-xs sm:text-sm bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Clear search"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No matching documents" : "No documents attested yet"}
              description={
                searchQuery
                  ? "No registered records matched your query. Try a different search term."
                  : "Upload a document above to generate its SHA-256 Merkle tree and immutable hash-chained audit record."
              }
              action={
                searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-xs font-semibold text-blue-600 underline"
                  >
                    Clear Search Filter
                  </button>
                ) : user?.role !== "VIEWER" ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                  >
                    <UploadCloudIcon className="w-4 h-4" />
                    Select File to Attest
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Desktop Table View (Hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-3 px-4">Document Title</th>
                      <th scope="col" className="py-3 px-4">Size</th>
                      <th scope="col" className="py-3 px-4">Merkle Root</th>
                      <th scope="col" className="py-3 px-4">Registered</th>
                      <th scope="col" className="py-3 px-4 text-right">Attestation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredDocs.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/documents/${d.id}`)}
                      >
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <FileTextIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <Link
                              href={`/documents/${d.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {d.title}
                            </Link>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs font-medium">
                          {formatFileSize(d.fileSize)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                              {d.merkleRoot.slice(0, 10)}…{d.merkleRoot.slice(-6)}
                            </span>
                            <CopyButton text={d.merkleRoot} title="Copy full Merkle Root" />
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/documents/${d.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 group-hover:translate-x-0.5 transition-all p-1"
                          >
                            View Audit Trail
                            <ArrowRightIcon className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Card View (Shown on screens < md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredDocs.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/documents/${d.id}`)}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all space-y-3 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileTextIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <h3 className="font-semibold text-slate-900 text-sm truncate">
                          {d.title}
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex-shrink-0">
                        {formatFileSize(d.fileSize)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Merkle Root
                      </span>
                      <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                        <span className="truncate">
                          {d.merkleRoot.slice(0, 12)}…{d.merkleRoot.slice(-8)}
                        </span>
                        <CopyButton text={d.merkleRoot} title="Copy Merkle Root" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
                      <span>
                        {new Date(d.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <Link
                        href={`/documents/${d.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 min-h-[36px] py-1"
                      >
                        Inspect Proofs
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
