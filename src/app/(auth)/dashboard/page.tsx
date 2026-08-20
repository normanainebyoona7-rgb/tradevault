import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import Signal from "@/lib/models/signal";
import mongoose from "mongoose";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  const userId = new mongoose.Types.ObjectId(session.id);
  const trades = await Trade.find({ userId }).sort({ exitDate: -1 }).lean();
  const signals = await Signal.find({ isActive: true }).sort({ createdAt: -1 }).lean();

  const totalTrades = trades.length;
  const wins = trades.filter((t: any) => t.status === "win");
  const losses = trades.filter((t: any) => t.status === "loss");
  const totalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(1) : "0";
  const totalWinsPnl = wins.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  const totalLossesPnl = Math.abs(losses.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0));
  const profitFactor = totalLossesPnl > 0 ? (totalWinsPnl / totalLossesPnl).toFixed(2) : "∞";

  // Market analysis data (simulated for display)
  const marketPairs = [
    { pair: "EUR/USD", price: "1.0850", change: "+0.25%", trend: "UPTREND", bias: "Bullish", signal: "BUY" },
    { pair: "GBP/USD", price: "1.2700", change: "-0.15%", trend: "DOWNTREND", bias: "Bearish", signal: "SELL" },
    { pair: "USD/JPY", price: "148.50", change: "+0.40%", trend: "UPTREND", bias: "Bullish", signal: "BUY" },
    { pair: "XAU/USD", price: "2400.00", change: "+0.80%", trend: "STRONG UPTREND", bias: "Strong Bullish", signal: "BUY" },
    { pair: "BTC/USD", price: "67250.00", change: "-1.20%", trend: "DOWNTREND", bias: "Bearish", signal: "SELL" },
    { pair: "ETH/USD", price: "3250.00", change: "+0.10%", trend: "NEUTRAL", bias: "Neutral", signal: "WAIT" },
  ];

  return (
    <div style={{ padding: "12px", width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#111827" }}>Trading Dashboard</h1>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>Welcome back, {session.name}!</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/calculator" style={{ padding: "8px 16px", background: "#e5e7eb", color: "#111827", borderRadius: "8px", fontWeight: "600", fontSize: "13px", textDecoration: "none" }}>
            Calculator
          </Link>
          <Link href="/journal/new" style={{ padding: "8px 16px", background: "#1c69e3", color: "#fff", borderRadius: "8px", fontWeight: "600", fontSize: "13px", textDecoration: "none" }}>
            + New Trade
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "#16a34a" : "#dc2626" },
          { label: "Win Rate", value: `${winRate}%`, color: "#1c69e3" },
          { label: "Trades", value: String(totalTrades), color: "#111827" },
          { label: "Profit Factor", value: profitFactor, color: "#7c3aed" },
        ].map((stat, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>{stat.label}</p>
            <p style={{ fontSize: "20px", fontWeight: "800", color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Forex Market Analysis */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>
          📊 Forex Market Analysis
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Pair</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Price</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Change</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Trend</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Bias</th>
                <th style={{ textAlign: "left", padding: "8px", fontSize: "12px" }}>Signal</th>
              </tr>
            </thead>
            <tbody>
              {marketPairs.map((market, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px", fontWeight: "700", fontSize: "13px" }}>{market.pair}</td>
                  <td style={{ padding: "8px", fontSize: "13px" }}>{market.price}</td>
                  <td style={{ padding: "8px", fontSize: "13px", color: market.change.startsWith("+") ? "#16a34a" : "#dc2626" }}>{market.change}</td>
                  <td style={{ padding: "8px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                      background: market.trend.includes("UP") ? "#dcfce7" : market.trend.includes("DOWN") ? "#fee2e2" : "#f3f4f6",
                      color: market.trend.includes("UP") ? "#16a34a" : market.trend.includes("DOWN") ? "#dc2626" : "#6b7280",
                    }}>
                      {market.trend}
                    </span>
                  </td>
                  <td style={{ padding: "8px", fontSize: "12px" }}>{market.bias}</td>
                  <td style={{ padding: "8px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "700",
                      background: market.signal === "BUY" ? "#dcfce7" : market.signal === "SELL" ? "#fee2e2" : "#fef3c7",
                      color: market.signal === "BUY" ? "#16a34a" : market.signal === "SELL" ? "#dc2626" : "#f59e0b",
                    }}>
                      {market.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Signals */}
      {signals.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>📊 Active Trading Signals</h2>
          {signals.map((signal: any) => (
            <div key={signal._id.toString()} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
              <p style={{ fontWeight: "700", fontSize: "14px" }}>
                {signal.pair}{" "}
                <span style={{ color: signal.direction === "long" ? "#16a34a" : "#dc2626", fontSize: "12px" }}>
                  {signal.direction?.toUpperCase()}
                </span>
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Entry: {signal.entry} | SL: {signal.stopLoss}
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                TP: {signal.takeProfit1}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Trades */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700" }}>Recent Trades</h2>
          <Link href="/journal" style={{ color: "#1c69e3", fontSize: "13px", textDecoration: "none" }}>View All →</Link>
        </div>
        {trades.length > 0 ? (
          trades.slice(0, 5).map((trade: any) => (
            <div key={trade._id.toString()} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <p style={{ fontWeight: "600", fontSize: "13px" }}>
                  {trade.pair}{" "}
                  <span style={{ fontSize: "11px", color: trade.direction === "long" ? "#16a34a" : "#dc2626" }}>
                    {trade.direction?.toUpperCase()}
                  </span>
                </p>
                <p style={{ fontSize: "11px", color: "#6b7280" }}>
                  {new Date(trade.exitDate || trade.entryDate).toLocaleDateString()}
                </p>
              </div>
              <p style={{ fontWeight: "700", fontSize: "14px", color: (trade.pnl || 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                {(trade.pnl || 0) >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)}
              </p>
            </div>
          ))
        ) : (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "30px", fontSize: "14px" }}>
            No trades yet. Start journaling!
          </p>
        )}
      </div>
    </div>
  );
}