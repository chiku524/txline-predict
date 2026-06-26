import type { Metadata } from "next";
import { ClientShell } from "@/components/ClientShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "TxLINE Predict — Verifiable World Cup Prediction Markets",
  description:
    "Permissionless prediction markets on Solana, powered by TxLINE real-time World Cup data and cryptographic settlement proofs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
