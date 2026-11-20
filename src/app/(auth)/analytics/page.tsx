"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  ChartLine,
  ChartPie,
  LayoutDashboard,
  Percent,
  Target,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

const COLORS = {
  win: "#10b981",
  loss: "#f43f5e",
  breakeven: "#f59e0b",
  primary: "#059669",
  primarySoft: "#34d399",
  amber: "#f59e0b",
};

export default function AnalyticsPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme } = useTheme();

  useEffect(() => {
    fetch("/api/trades?limit=100")
      .then((res) => res.json())
      .then((data) => setTrades(data.trades || []))
      .catch(() => {});

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
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
    { name: "Wins", value: wins, color: COLORS.win },
    { name: "Losses", value: losses, color: COLORS.loss },
    { name: "Breakeven", value: breakeven, color: COLORS.breakeven },
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

  // Chart theme tokens
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#1f3631" : "#e4e9e6";
  const axisStroke = isDark ? "#5c736c" : "#7d8f88";
  const tooltipStyle = {
    background: isDark ? "#10201c" : "#ffffff",
    border: `1px solid ${isDark ? "#1f3631" : "#dde5e1"}`,
    borderRadius: "0.75rem",
    color: isDark ? "#e8f1ee" : "#0f1f1a",
    fontSize: 12,
    boxShadow: "0 12px 32px -16px rgb(5 150 105 / 0.35)",
  };

  const stats = [
    {
      label: "Total Trades",
      value: String(trades.length),
      icon: BarChart3,
      tone: "text-foreground",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: Percent,
      tone: "text-foreground",
    },
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      icon: Wallet,
      tone:
        totalPnl >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Profit Factor",
      value: profitFactor.toFixed(2),
      icon: Target,
      tone:
        profitFactor >= 1
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Win rate, equity curve and performance by pair, direction and
            session.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
          <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
          {currentTime.toLocaleTimeString()}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${stat.tone}`}>
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Win/Loss Pie Chart */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ChartPie className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">
            Win/Loss Distribution
          </h2>
        </div>
        {pieData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            No closed trades yet — log a trade to see your distribution.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill={COLORS.primary}
                dataKey="value"
                stroke={isDark ? "#10201c" : "#ffffff"}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* PnL Timeline Chart */}
      {pnlTimeline.length > 1 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <ChartLine className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Cumulative P&L</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pnlTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="index"
                stroke={axisStroke}
                tick={{ fontSize: 12 }}
                label={{ value: "Trade Number", position: "insideBottom", offset: -5 }}
              />
              <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Direction Performance Bar Chart */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-base font-bold tracking-tight">
          Direction Performance
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={directionData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="name" stroke={axisStroke} tick={{ fontSize: 12 }} />
            <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="trades" fill={COLORS.primary} name="Number of Trades" radius={[6, 6, 0, 0]} />
            <Bar dataKey="pnl" fill={COLORS.primarySoft} name="P&L ($)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Pair Performance */}
      {pairData.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Pair Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pairData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="pair" stroke={axisStroke} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="trades" fill={COLORS.primary} name="Trades" radius={[6, 6, 0, 0]} />
              <Bar dataKey="pnl" fill={COLORS.amber} name="P&L ($)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Session Performance */}
      {sessionData.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Session Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} tick={{ fontSize: 12 }} />
              <YAxis stroke={axisStroke} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="trades" fill={COLORS.primary} name="Trades" radius={[6, 6, 0, 0]} />
              <Bar dataKey="wins" fill={COLORS.primarySoft} name="Wins" radius={[6, 6, 0, 0]} />
              <Bar dataKey="pnl" fill={COLORS.amber} name="P&L ($)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
