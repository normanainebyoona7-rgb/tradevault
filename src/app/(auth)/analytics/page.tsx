"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    fetch("/api/trades?limit=100")
      .then((res) => res.json())
      .then((data) => setTrades(data.trades || []))
      .catch(() => {});

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const wins = trades.filter((t) => t.status === "win").length;
  const losses = trades.filter((t) => t.status === "loss").length;
  const breakeven = trades.filter((t) => t.status === "breakeven").length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0";
  const avgWin = wins > 0 ? trades.filter((t) => t.status === "win").reduce((sum, t) => sum + (t.pnl || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? trades.filter((t) => t.status === "loss").reduce((sum, t) => sum + (t.pnl || 0), 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  // Pie chart data
  const pieData = [
    { name: "Wins", value: wins, color: "#16a34a" },
    { name: "Losses", value: losses, color: "#dc2626" },
    { name: "Breakeven", value: breakeven, color: "#f59e0b" },
  ].filter((item) => item.value > 0);

  // Direction performance
  const directionData = [
    { name: "Long", trades: trades.filter((t) => t.direction === "long").length, pnl: trades.filter((t) => t.direction === "long").reduce((sum, t) => sum + (t.pnl || 0), 0) },
    { name: "Short", trades: trades.filter((t) => t.direction === "short").length, pnl: trades.filter((t) => t.direction === "short").reduce((sum, t) => sum + (t.pnl || 0), 0) },
  ];

  // Pair performance
  const pairData = Object.entries(
    trades.reduce((acc: any, t) => {
      const pair = t.pair || "Unknown";
      if (!acc[pair]) acc[pair] = { pair, trades: 0, wins: 0, pnl: 0 };
      acc[pair].trades++;
      if (t.status === "win") acc[pair].wins++;
      acc[pair].pnl += (t.pnl || 0);
      return acc;
    }, {})
  ).map(([key, value]: [string, any]) => ({
    pair: key,
    trades: value.trades,
    winRate: value.trades > 0 ? ((value.wins / value.trades) * 100).toFixed(1) : "0",
    pnl: value.pnl,
  }));

  // Session performance
  const sessionData = ["london", "new_york", "asian", "other"]
    .map((session) => ({
      name: session.replace("_", " ").toUpperCase(),
      trades: trades.filter((t) => t.session === session).length,
      wins: trades.filter((t) => t.session === session && t.status === "win").length,
      pnl: trades.filter((t) => t.session === session).reduce((sum, t) => sum + (t.pnl || 0), 0),
    }))
    .filter((s) => s.trades > 0);

  // PnL over time (cumulative)
  const pnlTimeline = trades
    .slice()
    .sort((a, b) => new Date(a.createdAt || a.date || Date.now()).getTime() - new Date(b.createdAt || b.date || Date.now()).getTime())
    .map((t, index, arr) => ({
      index: index + 1,
      pnl: arr.slice(0, index + 1).reduce((sum, trade) => sum + (trade.pnl || 0), 0),
    }));

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "12px" : "24px" }}>
      <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "700", marginBottom: "24px" }}>📊 Analytics Dashboard</h1>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Trades</p>
          <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "800" }}>{trades.length}</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Win Rate</p>
          <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "800", color: "#1c69e3" }}>{winRate}%</p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Total P&L</p>
          <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "800", color: totalPnl >= 0 ? "#16a34a" : "#dc2626" }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>Profit Factor</p>
          <p style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "800", color: profitFactor >= 1 ? "#16a34a" : "#dc2626" }}>
            {profitFactor.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Win/Loss Pie Chart */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Win/Loss Distribution</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PnL Timeline Chart */}
      {pnlTimeline.length > 1 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Cumulative P&L</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pnlTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" label={{ value: "Trade Number", position: "insideBottom", offset: -5 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pnl" stroke="#1c69e3" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Direction Performance Bar Chart */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Direction Performance</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={directionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="trades" fill="#1c69e3" name="Number of Trades" />
            <Bar dataKey="pnl" fill="#16a34a" name="P&L ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pair Performance */}
      {pairData.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Pair Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pairData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pair" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="trades" fill="#783ff5" name="Trades" />
              <Bar dataKey="pnl" fill="#f59e0b" name="P&L ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Session Performance */}
      {sessionData.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Session Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="trades" fill="#1c69e3" name="Trades" />
              <Bar dataKey="wins" fill="#16a34a" name="Wins" />
              <Bar dataKey="pnl" fill="#f59e0b" name="P&L ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}