import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import mongoose from "mongoose";
import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  const userId = new mongoose.Types.ObjectId(session.id);
  const trades = await Trade.find({ userId }).sort({ entryDate: -1 }).lean();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade journal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {trades.length} trades logged
          </p>
        </div>
        <Link
          href="/journal/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          New Trade
        </Link>
      </div>

      {trades.length > 0 ? (
        <div className="space-y-3">
          {trades.map((trade: any) => {
            const value = trade.pnl || 0;
            return (
              <Link
                key={trade._id.toString()}
                href={`/journal/${trade._id.toString()}`}
                className="hover-lift flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/25 hover:shadow-card-hover"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(trade.entryDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      value >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {value >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)}
                  </p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-5 w-5" />
            <p className="mb-4">No trades found.</p>
            <Link
              href="/journal/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              Log Your First Trade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
