"use client";

import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetch("/api/trades?limit=100")
      .then((res) => res.json())
      .then((data) => setTrades(data.trades || []))
      .catch(() => {});

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const wins = trades.filter((t) => t.status === "win").length;
  const losses = trades.filter((t) => t.status === "loss").length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0";

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "24px" }}>📊 Analytics Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>📅 Date</p>
          <p style={{ fontSize: "16px", fontWeight: "700" }}>{currentTime.toLocaleDateString()}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>⏰ Time</p>
          <p style={{ fontSize: "16px", fontWeight: "700" }}>{currentTime.toLocaleTimeString()}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Trades</p>
          <p style={{ fontSize: "28px", fontWeight: "800" }}>{trades.length}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Win Rate</p>
          <p style={{ fontSize: "28px", fontWeight: "800", color: "#1c69e3" }}>{winRate}%</p>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Win/Loss Distribution</h2>
        <div style={{ display: "flex", justifyContent: "center", gap: "32px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", border: "8px solid #16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <span style={{ fontSize: "24px", fontWeight: "800", color: "#16a34a" }}>{wins}</span>
            </div>
            <p style={{ marginTop: "8px", color: "#6b7280" }}>Wins</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", border: "8px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <span style={{ fontSize: "24px", fontWeight: "800", color: "#dc2626" }}>{losses}</span>
            </div>
            <p style={{ marginTop: "8px", color: "#6b7280" }}>Losses</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Total P&L</h2>
        <p style={{ fontSize: "36px", fontWeight: "800", color: totalPnl >= 0 ? "#16a34a" : "#dc2626" }}>
          {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
        </p>
      </div>
    </div>
  );
}