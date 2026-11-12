import React from "react";
import Link from "next/link";
import { ShieldCheckIcon, LayersIcon, LockIcon } from "./Icons";

export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 text-white font-bold tracking-wide">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
              <span>VAULT ATTESTATION ENGINE</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Enterprise cryptographic document verification platform. Protects sensitive contracts, certifications, and digital assets using SHA-256 Merkle trees and immutable hash-chained audit sequences.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700">
                Zero File Storage
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700">
                 Merkle Byte Localization
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700">
                 Hash Chain Verifier
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Overview & Architecture
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Document Ledger
                </Link>
              </li>
              <li>
                <Link href="/verify" className="hover:text-white transition-colors">
                  Public Verification Portal
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Cryptographic Guarantees
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• SHA-256 Cryptographic Digest</li>
              <li>• Sub-block Tampering Pinpointer</li>
              <li>• Append-Only Audit Proofs</li>
              <li>• Tenant-Isolated Access Control</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Vault Cryptographic Attestation. Enterprise Grade Security.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Cryptographic Hash Integrity Online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
