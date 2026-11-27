// src/lib/market-structure.ts
// ICT market structure: BOS / CHoCH, premium & discount, liquidity sweeps,
// and the active killzone. Pure functions — safe to run on the client.

import type { Candle } from "@/lib/data/candles";

export interface StructureEvent {
  type: "BOS" | "CHoCH";
  direction: "bullish" | "bearish";
  level: number;
  index: number;
  time: number;
}

export interface StructureSwing {
  kind: "high" | "low";
  price: number;
  index: number;
  time: number;
}

export interface MarketStructure {
  trend: "bullish" | "bearish" | "neutral";
  lastEvent: StructureEvent | null;
  events: StructureEvent[];
  lastSwingHigh: StructureSwing | null;
  lastSwingLow: StructureSwing | null;
}

export interface PremiumDiscount {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  position: number; // 0 = range low, 1 = range high
  zone: "premium" | "discount" | "equilibrium";
  oteHigh: number; // 0.62 retracement of the range
  oteLow: number; // 0.79 retracement of the range
}

export interface LiquiditySweep {
  side: "buy_side" | "sell_side";
  level: number;
  index: number;
  time: number;
  reclaimed: boolean;
}

export interface Killzone {
  name: "Asian" | "London" | "London/NY overlap" | "New York";
  active: boolean;
  startHourUtc: number;
  endHourUtc: number;
}

function swingPoints(candles: Candle[], lookback: number = 2): StructureSwing[] {
  const points: StructureSwing[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (c.high <= candles[i - j].high || c.high <= candles[i + j].high) isHigh = false;
      if (c.low >= candles[i - j].low || c.low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) points.push({ kind: "high", price: c.high, index: i, time: c.time });
    if (isLow) points.push({ kind: "low", price: c.low, index: i, time: c.time });
  }
  return points;
}

export function detectMarketStructure(candles: Candle[]): MarketStructure {
  const empty: MarketStructure = {
    trend: "neutral",
    lastEvent: null,
    events: [],
    lastSwingHigh: null,
    lastSwingLow: null,
  };
  if (candles.length < 20) return empty;

  const swings = swingPoints(candles, 2);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");

  const events: StructureEvent[] = [];
  let trend: "bullish" | "bearish" | "neutral" = "neutral";

  // Walk forward: a swing becomes a broken level once a later candle closes
  // beyond it. The first break in a direction is CHoCH, continuations are BOS.
  let hi = 0;
  let lo = 0;
  let pendingHigh: StructureSwing | null = null;
  let pendingLow: StructureSwing | null = null;

  for (let i = 0; i < candles.length; i++) {
    while (hi < highs.length && highs[hi].index + 2 <= i) {
      if (!pendingHigh || highs[hi].index > pendingHigh.index) pendingHigh = highs[hi];
      hi++;
    }
    while (lo < lows.length && lows[lo].index + 2 <= i) {
      if (!pendingLow || lows[lo].index > pendingLow.index) pendingLow = lows[lo];
      lo++;
    }

    const close = candles[i].close;

    if (pendingHigh && close > pendingHigh.price) {
      const event: StructureEvent = {
        type: trend === "bullish" ? "BOS" : "CHoCH",
        direction: "bullish",
        level: pendingHigh.price,
        index: i,
        time: candles[i].time,
      };
      events.push(event);
      trend = "bullish";
      pendingHigh = null;
    }

    if (pendingLow && close < pendingLow.price) {
      const event: StructureEvent = {
        type: trend === "bearish" ? "BOS" : "CHoCH",
        direction: "bearish",
        level: pendingLow.price,
        index: i,
        time: candles[i].time,
      };
      events.push(event);
      trend = "bearish";
      pendingLow = null;
    }
  }

  const lastSwingHigh = highs.length > 0 ? highs[highs.length - 1] : null;
  const lastSwingLow = lows.length > 0 ? lows[lows.length - 1] : null;

  return {
    trend,
    lastEvent: events.length > 0 ? events[events.length - 1] : null,
    events: events.slice(-6),
    lastSwingHigh,
    lastSwingLow,
  };
}

export function premiumDiscount(candles: Candle[], lookback: number = 60): PremiumDiscount | null {
  if (candles.length < 10) return null;
  const recent = candles.slice(-lookback);
  const rangeHigh = Math.max(...recent.map((c) => c.high));
  const rangeLow = Math.min(...recent.map((c) => c.low));
  const span = rangeHigh - rangeLow;
  if (span <= 0) return null;

  const price = recent[recent.length - 1].close;
  const position = (price - rangeLow) / span;
  // OTE is the 62–79% retracement of the dealing range.
  const oteHigh = rangeHigh - span * 0.62;
  const oteLow = rangeHigh - span * 0.79;

  let zone: PremiumDiscount["zone"] = "equilibrium";
  if (position > 0.55) zone = "premium";
  else if (position < 0.45) zone = "discount";

  return {
    rangeHigh,
    rangeLow,
    equilibrium: rangeLow + span / 2,
    position: Number(position.toFixed(3)),
    zone,
    oteHigh,
    oteLow,
  };
}

export function detectLiquiditySweeps(candles: Candle[], lookback: number = 40): LiquiditySweep[] {
  if (candles.length < lookback + 2) return [];
  const sweeps: LiquiditySweep[] = [];
  const start = candles.length - lookback;

  for (let i = start; i < candles.length; i++) {
    const window = candles.slice(Math.max(0, i - 20), i);
    if (window.length < 5) continue;
    const priorHigh = Math.max(...window.map((c) => c.high));
    const priorLow = Math.min(...window.map((c) => c.low));
    const c = candles[i];

    if (c.high > priorHigh && c.close < priorHigh) {
      sweeps.push({
        side: "buy_side",
        level: priorHigh,
        index: i,
        time: c.time,
        reclaimed: true,
      });
    }
    if (c.low < priorLow && c.close > priorLow) {
      sweeps.push({
        side: "sell_side",
        level: priorLow,
        index: i,
        time: c.time,
        reclaimed: true,
      });
    }
  }

  return sweeps.slice(-4);
}

export function activeKillzone(now: Date = new Date()): Killzone {
  const hour = now.getUTCHours();
  const zones: Killzone[] = [
    { name: "Asian", active: hour >= 0 && hour < 4, startHourUtc: 0, endHourUtc: 4 },
    { name: "London", active: hour >= 7 && hour < 10, startHourUtc: 7, endHourUtc: 10 },
    {
      name: "London/NY overlap",
      active: hour >= 12 && hour < 16,
      startHourUtc: 12,
      endHourUtc: 16,
    },
    { name: "New York", active: hour >= 13 && hour < 16, startHourUtc: 13, endHourUtc: 16 },
  ];
  return zones.find((z) => z.active) ?? zones[0];
}

export function structureSummary(structure: MarketStructure): string {
  const event = structure.lastEvent;
  if (!event) return `No confirmed break (${structure.trend})`;
  return `${event.type} ${event.direction} at ${event.level}`;
}
