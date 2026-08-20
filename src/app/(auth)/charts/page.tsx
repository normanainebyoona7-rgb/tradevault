"use client";

import { useEffect, useState } from "react";

export default function ChartsPage() {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/trades?limit=100")
      .then((res) => res.json())
      .then((data) => setTrades(data.trades || []))
      .catch(() => {});
  }, []);

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.status === "win").length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0";
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const sessionData = ["london", "new_york", "asian", "other"].map((session) => ({
    name: session.replace("_", " "),
    trades: trades.filter((t) => t.session === session).length,
    pnl: trades.filter((t) => t.session === session).reduce((sum, t) => sum + (t.pnl || 0), 0),
  }));

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>📈 Charts & Analytics</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Trades</p>
          <p style={{ fontSize: "28px", fontWeight: "800" }}>{totalTrades}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Win Rate</p>
          <p style={{ fontSize: "28px", fontWeight: "800", color: "#1c69e3" }}>{winRate}%</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Total P&L</p>
          <p style={{ fontSize: "28px", fontWeight: "800", color: totalPnl >= 0 ? "#16a34a" : "#dc2626" }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Session Performance</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          {sessionData.map((session) => (
            <div key={session.name} style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
              <p style={{ fontWeight: "600", textTransform: "capitalize" }}>{session.name}</p>
              <p style={{ fontWeight: "700" }}>{session.trades} trades | {session.pnl >= 0 ? "+" : ""}${session.pnl.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}