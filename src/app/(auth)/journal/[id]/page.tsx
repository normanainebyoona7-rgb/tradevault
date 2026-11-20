// src/app/(auth)/journal/[id]/page.tsx

import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import mongoose from "mongoose";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  const userId = new mongoose.Types.ObjectId(session.id);

  let trade: any = null;
  try {
    trade = await Trade.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId,
    }).lean();
  } catch (error) {
    trade = null;
  }

  if (!trade) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            <p className="mb-4">Trade not found.</p>
            <Link
              href="/journal"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Journal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isWin = trade.status === "win";
  const isLoss = trade.status === "loss";

  const statusTone = isWin
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    : isLoss
      ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
      : trade.status === "breakeven"
        ? "bg-muted text-muted-foreground"
        : "bg-accent text-accent-foreground";

  const pnlTone = isWin
    ? "text-emerald-600 dark:text-emerald-400"
    : isLoss
      ? "text-rose-600 dark:text-rose-400"
      : "text-foreground";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Journal
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {trade.pair}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                trade.direction === "long"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
              }`}
            >
              {trade.direction.toUpperCase()}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone}`}
            >
              {trade.status}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Logged {new Date(trade.entryDate).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/journal/${trade._id.toString()}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            PnL
          </span>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${pnlTone}`}>
            {(trade.pnl || 0) > 0 ? "+" : ""}$
            {trade.pnl?.toFixed(2) || "0.00"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            R-Multiple
          </span>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {trade.rMultiple?.toFixed(2)}R
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <p className={`mt-1 text-2xl font-bold capitalize ${pnlTone}`}>
            {trade.status}
          </p>
        </div>
      </div>

      {/* Entry/Exit Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Entry Details
          </h2>
          <dl className="divide-y divide-border text-sm">
            <div className="flex items-center justify-between py-2.5 first:pt-0">
              <dt className="text-muted-foreground">Entry Price</dt>
              <dd className="font-semibold tabular-nums">{trade.entryPrice}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-muted-foreground">Stop Loss</dt>
              <dd className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {trade.stopLoss}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-muted-foreground">Take Profit</dt>
              <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {trade.takeProfit}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-muted-foreground">Position Size</dt>
              <dd className="font-semibold tabular-nums">
                {trade.positionSize} lots
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5 last:pb-0">
              <dt className="text-muted-foreground">Entry Date</dt>
              <dd className="font-semibold">
                {new Date(trade.entryDate).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Exit Details
          </h2>
          {trade.exitPrice ? (
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between py-2.5 first:pt-0">
                <dt className="text-muted-foreground">Exit Price</dt>
                <dd className="font-semibold tabular-nums">{trade.exitPrice}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Exit Date</dt>
                <dd className="font-semibold">
                  {trade.exitDate
                    ? new Date(trade.exitDate).toLocaleString()
                    : "N/A"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Risk Amount</dt>
                <dd className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  ${trade.riskAmount?.toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 last:pb-0">
                <dt className="text-muted-foreground">Reward Amount</dt>
                <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  ${trade.rewardAmount?.toFixed(2)}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <Clock className="mx-auto mb-2 h-5 w-5" />
              Trade still open — no exit details yet.
            </div>
          )}
        </section>
      </div>

      {/* Categorization */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-base font-bold tracking-tight">
          Categorization
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Session
            </p>
            <p className="mt-1 font-semibold capitalize">
              {trade.session?.replace("_", " ")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Strategy
            </p>
            <p className="mt-1 font-semibold">{trade.strategy || "N/A"}</p>
          </div>
        </div>

        {trade.tags && trade.tags.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {trade.tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {trade.mistakes && trade.mistakes.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mistakes
            </p>
            <div className="flex flex-wrap gap-2">
              {trade.mistakes.map((mistake: string, index: number) => (
                <span
                  key={index}
                  className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-rose-700 dark:text-rose-400"
                >
                  {mistake.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Notes */}
      {trade.notes && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Notes</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {trade.notes}
          </p>
        </section>
      )}
    </div>
  );
}
