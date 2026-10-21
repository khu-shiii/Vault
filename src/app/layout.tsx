import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault - Cryptographic Document Attestation",
  description: "End-to-end cryptographic document attestation and tamper-proof verification platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
