import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import Signal from "@/lib/models/signal";
import mongoose from "mongoose";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Calculator,
  CandlestickChart,
  Plus,
  Radio,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

  const pnlTone =
    totalPnl >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  const stats = [
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      icon: Wallet,
      tone: pnlTone,
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      icon: Target,
      tone: "text-foreground",
    },
    {
      label: "Trades",
      value: String(totalTrades),
      icon: CandlestickChart,
      tone: "text-foreground",
    },
    {
      label: "Profit Factor",
      value: profitFactor,
      icon: Activity,
      tone: "text-primary",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trading dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {session.name}! Here is how your book is doing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/calculator"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <Calculator className="h-4 w-4" />
            Calculator
          </Link>
          <Link
            href="/journal/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            New Trade
          </Link>
        </div>
      </div>

      {/* Stats */}
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

      {/* Live chart CTA */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <CandlestickChart className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight">Open live chart</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Forex, metals and crypto prices with structure, order blocks and
                supply &amp; demand overlays streamed tick by tick.
              </p>
            </div>
          </div>
          <Link
            href="/charts"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
          >
            Open live chart
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Active Signals */}
      {signals.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold tracking-tight">
                Active trading signals
              </h2>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {signals.length} live
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {signals.map((signal: any) => {
              const isLong = signal.direction === "long";
              return (
                <div
                  key={signal._id.toString()}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{signal.pair}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isLong
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {signal.direction?.toUpperCase()}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Entry</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {signal.entry}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">SL</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {signal.stopLoss}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">TP</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {signal.takeProfit1}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Trades */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">Recent trades</h2>
          <Link
            href="/journal"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition hover:opacity-80"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {trades.length > 0 ? (
          <ul className="divide-y divide-border">
            {trades.slice(0, 5).map((trade: any) => {
              const value = trade.pnl || 0;
              return (
                <li
                  key={trade._id.toString()}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {trade.pair}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          trade.direction === "long"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {trade.direction?.toUpperCase()}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(trade.exitDate || trade.entryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      value >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {value >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            <TrendingUp className="mx-auto mb-2 h-5 w-5" />
            No trades yet. Start journaling!
          </div>
        )}
      </section>
    </div>
  );
}
