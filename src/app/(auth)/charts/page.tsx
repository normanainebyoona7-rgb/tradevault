"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Target, TrendingUp, Wallet } from "lucide-react";
import { LiveChart } from "@/components/charts/LiveChart";

interface Trade {
  status?: string;
  pnl?: number;
  session?: string;
}

const SESSIONS = [
  { key: "london", label: "London" },
  { key: "new_york", label: "New York" },
  { key: "asian", label: "Asian" },
  { key: "other", label: "Other" },
];

export default function ChartsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);

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

  const sessions = SESSIONS.map((session) => {
    const rows = trades.filter((t) => t.session === session.key);
    return {
      ...session,
      trades: rows.length,
      pnl: rows.reduce((sum, t) => sum + (t.pnl || 0), 0),
    };
  });
  const maxAbsPnl = Math.max(...sessions.map((s) => Math.abs(s.pnl)), 1);

  const stats = [
    {
      label: "Total trades",
      value: String(totalTrades),
      icon: BarChart3,
      tone: "text-foreground",
    },
    {
      label: "Win rate",
      value: `${winRate}%`,
      icon: Target,
      tone: "text-primary",
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
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live charts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            32 instruments · SMC, ICT and supply &amp; demand overlays updating
            on every tick.
          </p>
        </div>
        <Link
          href="/ai-analysis"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
        >
          AI analysis
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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

      <LiveChart />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">
            Session performance
          </h2>
          <span className="text-xs text-muted-foreground">
            {totalTrades} logged trades
          </span>
        </div>

        {totalTrades === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            No trades logged yet. Journal a trade to see session performance.
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const width = Math.max(
                2,
                (Math.abs(session.pnl) / maxAbsPnl) * 100
              );
              const positive = session.pnl >= 0;
              return (
                <div key={session.key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold">{session.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {session.trades} trades ·{" "}
                      <span
                        className={
                          positive
                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                            : "font-semibold text-rose-600 dark:text-rose-400"
                        }
                      >
                        {positive ? "+" : ""}
                        ${session.pnl.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        positive
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        Prices stream from Swissquote (FX/metals) and Yahoo Finance (crypto).
      </div>
    </div>
  );
}
