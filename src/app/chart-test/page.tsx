import { LiveChart } from "@/components/charts/LiveChart";

export default function ChartTestPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16, fontSize: 20, fontWeight: 700 }}>
        Chart Test
      </h1>
      <LiveChart initialPair="EUR/USD" initialTimeframe="1H" />
    </div>
  );
}