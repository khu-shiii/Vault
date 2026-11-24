import Link from "next/link";
import { ShieldIcon } from "./Icons";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-900">Vault</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Document attestation using SHA-256 Merkle trees and a hash-chained audit log. Vault stores hashes, not your files.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-2 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Ledger
            </Link>
            <Link href="/verify" className="text-slate-600 hover:text-slate-900">
              Verify a file
            </Link>
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/register" className="text-slate-600 hover:text-slate-900">
              Create account
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} Vault. Academic project, not independently audited.
        </div>
      </div>
    </footer>
  );
}