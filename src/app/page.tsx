import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShieldCheckIcon, LayersIcon, LockIcon, ClockIcon, ArrowRightIcon } from "@/components/Icons";

const features = [
  {
    icon: LayersIcon,
    title: "Merkle tree chunking",
    body: "Files are split into 256 KB chunks and hashed into a Merkle tree. When a copy is checked, the changed chunks are identified.",
  },
  {
    icon: ClockIcon,
    title: "Hash-chained audit log",
    body: "Each event links to the hash of the event before it. Changing an old entry breaks every entry that follows.",
  },
  {
    icon: LockIcon,
    title: "Hashes only",
    body: "Vault records fingerprints, not file contents. Files are read in the browser, and only hashes are sent to the server.",
  },
];

const steps = [
  { n: "1", title: "Hash the file", body: "The file is hashed in your browser. Only the hashes leave your device." },
  { n: "2", title: "Record the root", body: "The Merkle root and the upload event are stored in the audit log." },
  { n: "3", title: "Check any copy", body: "Anyone can check a copy against the recorded root and see which parts differ." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Document attestation
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Prove a file is unchanged, without storing it.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Vault records SHA-256 fingerprints of your documents and a tamper-evident audit trail. When a copy is checked,
              it shows whether it matches and which parts changed.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/verify"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 sm:w-auto"
              >
                Verify a file
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto"
              >
                Create an account
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">What Vault does</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Three pieces work together: a fingerprint of the content, a log that cannot be edited quietly, and a
              check that works without access to the original file.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How verification works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="space-y-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {s.n}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}