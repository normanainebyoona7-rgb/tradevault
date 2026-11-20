"use client";

import { useState, useMemo } from "react";
import { Calculator, Scale, ShieldAlert, Target, TrendingUp } from "lucide-react";
import { PAIR_GROUPS, PAIRS } from "@/lib/pairs";

export default function CalculatorPage() {
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [pair, setPair] = useState("EUR/USD");
  const [stopLossPips, setStopLossPips] = useState(50);
  const [takeProfitPips, setTakeProfitPips] = useState(150);
  const [lotType, setLotType] = useState("standard");

  const contractSize = lotType === "standard" ? 100000 : lotType === "mini" ? 10000 : 1000;

  const results = useMemo(() => {
    const riskAmount = (accountBalance * riskPercent) / 100;
    const pipValue = pair.includes("JPY") ? 0.01 * contractSize : 0.0001 * contractSize;
    const positionSizeLots = stopLossPips > 0 ? riskAmount / (stopLossPips * pipValue) : 0;
    const potentialReward = takeProfitPips * pipValue * positionSizeLots;
    const riskRewardRatio = stopLossPips > 0 ? (takeProfitPips / stopLossPips).toFixed(2) : "0";

    return { riskAmount, pipValue, positionSizeLots, potentialReward, riskRewardRatio };
  }, [accountBalance, riskPercent, pair, stopLossPips, takeProfitPips, lotType]);

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary/40";
  const labelClass =
    "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

  const breakdown = [
    {
      label: "Risk Amount",
      value: `$${results.riskAmount.toFixed(2)}`,
      icon: ShieldAlert,
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Pip Value",
      value: `$${results.pipValue.toFixed(4)}`,
      icon: Scale,
      tone: "text-foreground",
    },
    {
      label: "Potential Reward",
      value: `$${results.potentialReward.toFixed(2)}`,
      icon: TrendingUp,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Risk : Reward",
      value: `1 : ${results.riskRewardRatio}`,
      icon: Target,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Position size calculator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Size your trades across {PAIRS.length} instruments with precise risk
            control.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          {pair}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Inputs */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold tracking-tight">
            Trade parameters
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Account Balance</label>
              <input
                type="number"
                className={inputClass}
                value={accountBalance}
                onChange={(e) => setAccountBalance(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Risk %</label>
              <input
                type="number"
                className={inputClass}
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Currency Pair</label>
              <select
                className={inputClass}
                value={pair}
                onChange={(e) => setPair(e.target.value)}
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
              <label className={labelClass}>Stop Loss (pips)</label>
              <input
                type="number"
                className={inputClass}
                value={stopLossPips}
                onChange={(e) => setStopLossPips(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Take Profit (pips)</label>
              <input
                type="number"
                className={inputClass}
                value={takeProfitPips}
                onChange={(e) => setTakeProfitPips(Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Lot Type</label>
              <select
                className={inputClass}
                value={lotType}
                onChange={(e) => setLotType(e.target.value)}
              >
                <option value="standard">Standard (100,000)</option>
                <option value="mini">Mini (10,000)</option>
                <option value="micro">Micro (1,000)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-brand-gradient-deep p-6 text-center shadow-card">
            <div className="pointer-events-none absolute inset-0 bg-grid-emerald opacity-60" />
            <div className="relative">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-100/80">
                <Calculator className="h-3.5 w-3.5" />
                Position Size
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-white">
                {results.positionSizeLots.toFixed(2)}{" "}
                <span className="text-lg font-semibold text-emerald-100/80">
                  lots
                </span>
              </p>
              <p className="mt-2 text-xs text-emerald-100/70">
                {pair} · {lotType} lot · risking {riskPercent}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {breakdown.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${item.tone}`}
                  >
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
