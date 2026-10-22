import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 space-y-4">
      <h1 className="text-3xl font-bold">Vault</h1>
      <p className="text-zinc-400">Document attestation with Merkle trees and a hash-chained audit log.</p>
      <div className="flex gap-4 text-emerald-400 underline">
        <Link href="/login">Sign in</Link>
        <Link href="/verify">Verify a file</Link>
      </div>
    </main>
  );
}
