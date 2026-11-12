import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Vault - Enterprise Cryptographic Attestation & Ledger",
  description:
    "Zero-knowledge document attestation, Merkle-tree block verification, and immutable hash-chained audit trails.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
