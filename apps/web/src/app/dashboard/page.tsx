import { WalletDashboard } from "@/components/WalletDashboard";
import { getMarkets } from "@/lib/markets";

export const revalidate = 60;

export default async function DashboardPage() {
  const markets = await getMarkets();

  return (
    <div>
      <WalletDashboard markets={markets} />
    </div>
  );
}
