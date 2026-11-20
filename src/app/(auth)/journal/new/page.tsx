"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Save, Tags } from "lucide-react";
import { PAIR_GROUPS } from "@/lib/pairs";

const SESSIONS = ["london", "new_york", "asian", "other"];

export default function NewTradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    pair: "EUR/USD",
    direction: "long",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    positionSize: "",
    exitPrice: "",
    session: "london",
    strategy: "",
    tags: "",
    notes: "",
    entryDate: new Date().toISOString().slice(0, 16),
    exitDate: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        pair: form.pair,
        direction: form.direction,
        entryPrice: Number(form.entryPrice),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        positionSize: Number(form.positionSize),
        exitPrice: form.exitPrice ? Number(form.exitPrice) : null,
        session: form.session,
        strategy: form.strategy,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()) : [],
        notes: form.notes,
        entryDate: new Date(form.entryDate),
        exitDate: form.exitDate ? new Date(form.exitDate) : null,
      };

      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create trade");
        setLoading(false);
        return;
      }

      window.location.href = "/journal";
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary/40";
  const labelClass =
    "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Link
          href="/journal"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to journal
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New trade entry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log the setup, the risk you took and what you learned.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Core details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Currency Pair</label>
              <select
                name="pair"
                value={form.pair}
                onChange={handleChange}
                className={inputClass}
              >
                {PAIR_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.pairs.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Direction</label>
              <select
                name="direction"
                value={form.direction}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Position Size (lots)</label>
              <input
                type="number"
                step="any"
                name="positionSize"
                value={form.positionSize}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Entry Price</label>
              <input
                type="number"
                step="any"
                name="entryPrice"
                value={form.entryPrice}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Stop Loss</label>
              <input
                type="number"
                step="any"
                name="stopLoss"
                value={form.stopLoss}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Take Profit</label>
              <input
                type="number"
                step="any"
                name="takeProfit"
                value={form.takeProfit}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Exit Price (optional)</label>
              <input
                type="number"
                step="any"
                name="exitPrice"
                value={form.exitPrice}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Entry Date</label>
              <input
                type="datetime-local"
                name="entryDate"
                value={form.entryDate}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">
              Categorization
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Session</label>
              <select
                name="session"
                value={form.session}
                onChange={handleChange}
                className={inputClass}
              >
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Strategy</label>
              <input
                type="text"
                name="strategy"
                value={form.strategy}
                onChange={handleChange}
                placeholder="e.g., Trendline Bounce"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Tags (comma separated)</label>
              <input
                type="text"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="#london, #trendline"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/journal"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Trade"}
          </button>
        </div>
      </form>
    </div>
  );
}
