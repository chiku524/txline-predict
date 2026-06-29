import type { Metadata } from "next";
import { WalletDashboard } from "@/components/WalletDashboard";
import { getMarkets } from "@/lib/markets";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "View your wallet, open positions, and settlement history for TxLINE Predict markets.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const markets = await getMarkets();

  return (
    <div>
      <WalletDashboard markets={markets} />
    </div>
  );
}
