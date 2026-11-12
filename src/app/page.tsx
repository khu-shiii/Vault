import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ShieldCheckIcon,
  LayersIcon,
  LockIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  ClockIcon,
} from "@/components/Icons";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
          
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            {/* <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-900/50 border border-blue-500/30 text-blue-300 text-xs sm:text-sm font-medium backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Enterprise Cryptographic Document Attestation
            </div> */}

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Cryptographic Proof of Authenticity,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">
                Zero Document Storage
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed">
              Vault binds sensitive files into SHA-256 Merkle trees and immutable hash-chained audit trails. Pinpoint byte-level tampering in seconds without ever storing original file contents.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/verify"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-600/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[48px]"
              >
                <ShieldCheckIcon className="w-5 h-5" />
                Verify a File Now
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </Link>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 active:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[48px]"
              >
                <FileTextIcon className="w-5 h-5 text-slate-400" />
                Open Document Ledger
              </Link>
            </div>

            {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 text-left border-t border-slate-800/80 max-w-3xl mx-auto">
              <div>
                <p className="text-2xl font-bold text-white">SHA-256</p>
                <p className="text-xs text-slate-400 mt-0.5">Merkle Leaf Digest</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">0 Bytes</p>
                <p className="text-xs text-slate-400 mt-0.5">Persisted File Storage</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">O(log n)</p>
                <p className="text-xs text-slate-400 mt-0.5">Proof Verification</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">100%</p>
                <p className="text-xs text-slate-400 mt-0.5">Hash Chain Audited</p>
              </div>
            </div> */}
          </div>
        </section>

        {/* Feature Cards Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-xs uppercase tracking-widest font-bold text-blue-600">
              Cryptographic Guarantees
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Engineered for Auditability, Privacy & Proof
            </h3>
            <p className="text-slate-600 text-sm sm:text-base">
              Traditional attestation systems store sensitive documents in centralized databases. Vault verifies authenticity mathematically while upholding zero-knowledge privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Card 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                {/* <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <LayersIcon className="w-6 h-6" />
                </div> */}
                <h4 className="text-lg font-bold text-slate-900">
                  Merkle Tree Chunking
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Documents are partitioned into discrete chunks and mapped into a hierarchical binary Merkle tree. When a candidate document is evaluated, altered byte ranges are pinpointed with precision.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Exact byte-offset tamper location
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Independent leaf hash validation
                </li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                {/* <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <LockIcon className="w-6 h-6" />
                </div> */}
                <h4 className="text-lg font-bold text-slate-900">
                  Hash-Chained Audit Ledger
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Every lifecycle event (upload, view, signature verification) is sequentially hashed with the previous entry’s state digest. Any historical tampering invalidates the mathematical continuity of the entire chain.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  Deterministic state verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  Immutable append-only sequences
                </li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                {/* <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                  <ShieldCheckIcon className="w-6 h-6" />
                </div> */}
                <h4 className="text-lg font-bold text-slate-900">
                  Zero File Storage
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  File bytes exist strictly in memory while hashes and Merkle proofs are computed, after which bytes are discarded. No raw contracts, trade secrets, or personal data ever reside on our disks.
                </p>
              </div>
              <ul className="mt-6 pt-6 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Zero liability document handling
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Tenant-isolated attestation records
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Workflow Showcase */}
        <section className="bg-white border-y border-slate-200 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center space-y-2">
              <h2 className="text-xs uppercase tracking-widest font-bold text-slate-500">
                How Verification Works
              </h2>
              <h3 className="text-2xl font-bold text-slate-900">
                3-Step Cryptographic Attestation Pipeline
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  1
                </div>
                <h4 className="font-semibold text-slate-900">Stream & Digest</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  File is streamed into fixed-size cryptographic blocks. SHA-256 hashes are computed for each leaf.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  2
                </div>
                <h4 className="font-semibold text-slate-900">Merkle Root Synthesis</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Leaves pair sequentially into parents up to a 64-character Merkle root bound to an initial UPLOAD audit entry.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  3
                </div>
                <h4 className="font-semibold text-slate-900">Instant Verification</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Public verifiers drop candidate files to verify authenticity or identify modified byte positions.
                </p>
              </div>
            </div>

            <div className="pt-6 text-center">
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all min-h-[44px]"
              >
                Try Document Verification
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
