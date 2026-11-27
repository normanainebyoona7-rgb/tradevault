"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  Crosshair,
  Gauge,
  Layers3,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { LiveChart } from "@/components/charts/LiveChart";

const ENGINE_CHECKS = [
  {
    icon: Boxes,
    title: "Supply & demand zones",
    body: "Base candles followed by an explosive departure, filtered by distance to live price.",
  },
  {
    icon: Layers3,
    title: "Order blocks & FVGs",
    body: "Institutional entry blocks and fair value gaps drawn as boxes on the chart.",
  },
  {
    icon: Waves,
    title: "Liquidity",
    body: "Buy-side and sell-side pools, plus sweep detection on wick rejections.",
  },
  {
    icon: Crosshair,
    title: "Market structure",
    body: "BOS and CHoCH labelled from confirmed swing breaks, with trend bias.",
  },
  {
    icon: Gauge,
    title: "Premium / discount",
    body: "Dealing range, equilibrium and OTE so entries stay on the correct side.",
  },
  {
    icon: BarChart3,
    title: "Volume profile",
    body: "Point of control, value-area high/low and high-volume nodes from server candle volume.",
  },
  {
    icon: ShieldCheck,
    title: "Risk model",
    body: "ATR-based stop, 1R / 1.5R / 3R targets, and broker-configured position sizing.",
  },
];

export default function AIAnalysisPage() {
  const [userTier, setUserTier] = useState("free");

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserTier(data.user.tier || "free");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI chart analysis
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Analyze the live chart with SMC, ICT, supply-and-demand and volume
            profile confluences. Fresh zones can stage a low-confidence limit
            while waiting for closed-bar confirmation.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Plan: <span className="uppercase text-primary">{userTier}</span>
        </div>
      </div>

      <LiveChart initialPair="XAU/USD" />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ScanSearch className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">
            What every analysis checks
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINE_CHECKS.map((check) => {
            const Icon = check.icon;
            return (
              <div
                key={check.title}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">{check.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {check.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
