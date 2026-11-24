"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { formatFileSize } from "@/lib/format";
import {
  FileTextIcon,
  UploadCloudIcon,
  ShieldCheckIcon,
  SearchIcon,
  Spinner,
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canAttest = !!user && user.role !== "VIEWER";

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api<{ documents: Doc[] }>("/api/documents");
      setDocs(res.documents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) return;

    const title = customTitle.trim();
    const label = title || selectedFile.name;
    setBusy(true);
    setError("");
    setSuccessMsg("");

    const fd = new FormData();
    fd.append("file", selectedFile);
    if (title) fd.append("title", title);

    try {
      await api("/api/documents", { method: "POST", body: fd });
      clearFile();
      setCustomTitle("");
      setSuccessMsg(`“${label}” has been attested.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onDropzoneKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.merkleRoot.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
    );
  }, [docs, searchQuery]);

  const latest = useMemo(() => {
    if (docs.length === 0) return null;
    return docs.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
  }, [docs]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document ledger</h1>
            <p className="mt-1 text-sm text-slate-600">
              Attested documents, their Merkle roots, and the audit trail for each.
            </p>
          </div>
          <Link
            href="/verify"
            className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:self-auto"
          >
            <ShieldCheckIcon className="h-4 w-4 text-indigo-600" />
            Verify a file
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 animate-fadeIn"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded p-0.5 text-rose-500 hover:text-rose-700"
              aria-label="Dismiss error"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-fadeIn"
          >
            <CheckIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span className="flex-1">{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="rounded p-0.5 text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss message"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Attested documents</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{loading ? "–" : docs.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Most recent attestation</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {loading ? "–" : latest ? formatDate(latest.createdAt) : "None yet"}
            </p>
          </div>
        </div>

        {canAttest && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">Attest a new document</h2>
              <p className="mt-1 text-sm text-slate-600">
                The file is hashed in your browser. Only its fingerprints are stored.
              </p>
            </div>

            <form onSubmit={onUpload} className="space-y-5 p-5 sm:p-6">
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a file to attest"
                onKeyDown={onDropzoneKey}
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
                className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50"
                    : selectedFile
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  name="file"
                  required
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <FileTextIcon className="h-5 w-5" />
                    </span>
                    <p className="max-w-full truncate text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)} · ready to attest</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      className="mt-1 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <UploadCloudIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-800">
                      <span className="text-indigo-600">Choose a file</span> or drop it here
                    </p>
                    <p className="text-xs text-slate-500">Any file type, up to 20 MB</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  name="title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Title (optional, defaults to the file name)"
                  className="h-10 w-full flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                />
                <button
                  type="submit"
                  disabled={!selectedFile || busy}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Spinner className="h-4 w-4 text-white" />
                      Attesting…
                    </>
                  ) : (
                    "Attest document"
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Documents <span className="font-normal text-slate-500">({filteredDocs.length})</span>
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">Select a document to see its audit trail and proofs.</p>
            </div>

            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or hash"
                aria-label="Search documents"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
              />
            </div>
          </div>

          <div className="p-2 sm:p-4">
            {loading ? (
              <div className="p-3">
                <TableSkeleton rows={5} />
              </div>
            ) : filteredDocs.length === 0 ? (
              <EmptyState
                title={searchQuery ? "No matching documents" : "No documents yet"}
                description={
                  searchQuery
                    ? "Nothing matches that search. Try a different title or hash."
                    : canAttest
                    ? "Attest your first document above. Vault will record its Merkle root in the audit log."
                    : "Documents attested by your organisation will appear here."
                }
                action={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Clear search
                    </button>
                  ) : canAttest ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                      <UploadCloudIcon className="h-4 w-4" />
                      Choose a file
                    </button>
                  ) : null
                }
              />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">Title</th>
                        <th scope="col" className="px-4 py-3">Size</th>
                        <th scope="col" className="px-4 py-3">Merkle root</th>
                        <th scope="col" className="px-4 py-3">Attested</th>
                        <th scope="col" className="px-4 py-3">
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredDocs.map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => router.push(`/documents/${d.id}`)}
                          className="cursor-pointer transition-colors hover:bg-slate-50"
                        >
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/documents/${d.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-slate-900 hover:text-indigo-600"
                            >
                              {d.title}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{formatFileSize(d.fileSize)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                                {d.merkleRoot.slice(0, 10)}…{d.merkleRoot.slice(-6)}
                              </code>
                              <CopyButton text={d.merkleRoot} title="Copy Merkle root" />
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                            {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                              View
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-3 md:hidden">
                  {filteredDocs.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/documents/${d.id}`}
                        className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-medium text-slate-900">{d.title}</p>
                          <span className="flex-shrink-0 text-xs text-slate-500">{formatFileSize(d.fileSize)}</span>
                        </div>
                        <div
                          className="mt-3 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <code className="truncate font-mono text-xs text-slate-700">
                            {d.merkleRoot.slice(0, 12)}…{d.merkleRoot.slice(-8)}
                          </code>
                          <CopyButton text={d.merkleRoot} title="Copy Merkle root" />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{formatDate(d.createdAt)}</span>
                          <span className="font-medium text-indigo-600">View proofs →</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}