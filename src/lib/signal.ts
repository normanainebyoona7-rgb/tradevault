// src/lib/signal.ts
// Signal orchestrator — ATR-based SL, Fibonacci TPs, no STOP orders.
//
// SL: entry ± 2.0 × ATR(14)
// TPs: Fibonacci extensions of the zone's swing (1.272 / 1.618 / 2.0)
// Orders: BUY, SELL, BUY LIMIT, SELL LIMIT, NEUTRAL only.
//         No BUY STOP / SELL STOP — removed per cheat-sheet doctrine.
//
// Zone filtering:
//   - Price must be INSIDE the zone, or within 0.5% of it
//   - Zones further than 0.5% away → NEUTRAL

import type { Candle } from "@/lib/data/candles";
import type { Overlays } from "@/lib/overlays";
import type { VerifiedPrice } from "@/lib/analysis";
import {
  detectZones,
  detectEntrySignal,
  type ZoneCandle,
  type SupplyDemandZone,
} from "@/lib/zone-strategy";

export type SignalDirection = "long" | "short" | "neutral";
export type OrderType = "market" | "limit" | "none";
export type SignalLabel =
  | "BUY" | "SELL" | "BUY LIMIT" | "SELL LIMIT" | "NEUTRAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NEUTRAL";

export interface SignalZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  strength: number;
  distanceToPrice: number;
}

export interface SignalEntryCandle {
  type: "large_range" | "engulfing" | "pin_bar" | "none";
  direction: "bullish" | "bearish";
  probability: number;
  reason: string;
}

export interface SignalConfluences {
  roundNumber: boolean;
  supertrendAligned: boolean;
  rsiAligned: boolean;
  smaAligned: boolean;
  vwapAligned: boolean;
  orderBlockNear: boolean;
  fvgNear: boolean;
  session: string;
  sessionFavorable: boolean;
}

export interface TradingSignal {
  pair: string;
  timeframe: string;
  timestamp: number;
  direction: SignalDirection;
  orderType: OrderType;
  signalLabel: SignalLabel;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  riskPips: number;
  rewardPips: [number, number, number];
  riskReward: [string, string, string];
  zone: SignalZone | null;
  entryCandle: SignalEntryCandle | null;
  confluences: SignalConfluences;
  confidence: Confidence;
  score: number;
  neutralReason?: string;
  notes: string[];
  priceVerification?: {
    chartPrice: number;
    yahooPrice: number | null;
    diffPct: number;
    tolerance: number;
    verified: boolean;
  };
}

// ===== HELPERS =====

function calcPipSize(pair: string): number {
  if (pair.includes("XAU")) return 0.10;
  if (pair.includes("XAG")) return 0.01;
  if (pair.includes("BTC")) return 1.00;
  if (pair.includes("ETH")) return 0.10;
  const [, quote] = pair.split("/");
  if (quote === "JPY") return 0.01;
  return 0.0001;
}

// ATR(14) — average true range over the last 14 candles
function calcATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    // Fallback: average candle range over what we have
    const ranges = candles.map((c) => c.high - c.low);
    return ranges.reduce((s, r) => s + r, 0) / Math.max(ranges.length, 1);
  }

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  // Wilder's smoothing (standard ATR)
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function getSession(): { name: string; favorable: boolean } {
  const hour = new Date().getUTCHours();
  if (hour >= 7 && hour <= 11) return { name: "LONDON", favorable: true };
  if (hour >= 12 && hour <= 16) return { name: "LONDON-NY OVERLAP", favorable: true };
  if (hour >= 17 && hour <= 21) return { name: "NEW YORK", favorable: true };
  if (hour >= 0 && hour <= 6) return { name: "ASIAN", favorable: false };
  return { name: "OFF-HOURS", favorable: false };
}

function nearestRoundNumber(
  pair: string,
  price: number
): { level: number; distancePct: number } | null {
  const upper = pair.toUpperCase();
  let step: number;
  if (upper.includes("XAU")) step = 50;
  else if (upper.includes("XAG")) step = 1;
  else if (upper.includes("BTC")) step = 5000;
  else if (upper.includes("ETH")) step = 500;
  else if (upper.includes("JPY")) step = 1;
  else step = 0.01;
  const nearest = Math.round(price / step) * step;
  const distance = Math.abs(price - nearest);
  return { level: nearest, distancePct: (distance / price) * 100 };
}

// ===== CONFLUENCE CHECKS =====

function checkSupertrendAligned(overlays: Overlays, direction: "long" | "short"): boolean {
  const st = overlays.supertrend;
  if (st.length === 0) return false;
  const latest = st[st.length - 1];
  return direction === "long" ? latest.direction === "up" : latest.direction === "down";
}

function checkRSIAligned(overlays: Overlays, direction: "long" | "short"): boolean {
  const rsi = overlays.rsi;
  if (rsi.length === 0) return false;
  const latest = rsi[rsi.length - 1].value;
  return direction === "long" ? latest < 55 : latest > 45;
}

function checkSMAAligned(overlays: Overlays, direction: "long" | "short"): boolean {
  const sma9 = overlays.sma9;
  const sma21 = overlays.sma21;
  if (sma9.length === 0 || sma21.length === 0) return false;
  const v9 = sma9[sma9.length - 1].value;
  const v21 = sma21[sma21.length - 1].value;
  return direction === "long" ? v9 > v21 : v9 < v21;
}

function checkVWAPAligned(overlays: Overlays, currentPrice: number, direction: "long" | "short"): boolean {
  const vwap = overlays.vwap;
  if (vwap.length === 0) return false;
  const v = vwap[vwap.length - 1].value;
  return direction === "long" ? currentPrice > v : currentPrice < v;
}

function checkOrderBlockNear(overlays: Overlays, currentPrice: number, direction: "long" | "short"): boolean {
  const obs = overlays.orderBlocks;
  if (obs.length === 0) return false;
  const targetType = direction === "long" ? "bullish" : "bearish";
  for (const ob of obs) {
    if (ob.type !== targetType) continue;
    const dist = currentPrice < ob.bottom ? ob.bottom - currentPrice : currentPrice > ob.top ? currentPrice - ob.top : 0;
    if ((dist / currentPrice) * 100 <= 0.3) return true;
  }
  return false;
}

function checkFVGNear(overlays: Overlays, currentPrice: number, direction: "long" | "short"): boolean {
  const fvgs = overlays.fvgs;
  if (fvgs.length === 0) return false;
  const targetType = direction === "long" ? "bullish" : "bearish";
  for (const fvg of fvgs) {
    if (fvg.type !== targetType) continue;
    const dist = currentPrice < fvg.bottom ? fvg.bottom - currentPrice : currentPrice > fvg.top ? currentPrice - fvg.top : 0;
    if ((dist / currentPrice) * 100 <= 0.3) return true;
  }
  return false;
}

// ===== FIBONACCI TPs =====
// TPs from the zone's swing range, extending outward.
// For a long: swing from zone.bottom → zone.top, TPs extend ABOVE zone.top.
// For a short: swing from zone.top → zone.bottom, TPs extend BELOW zone.bottom.
function computeFibonacciTPs(
  direction: "long" | "short",
  entry: number,
  stopLoss: number,
  zone: SupplyDemandZone
): { tp1: number; tp2: number; tp3: number } {
  const swingStart = direction === "long" ? zone.bottom : zone.top;
  const swingEnd = direction === "long" ? zone.top : zone.bottom;
  const swingRange = Math.abs(swingEnd - swingStart);
  const dirSign = direction === "long" ? 1 : -1;

  let tp1 = swingEnd + dirSign * swingRange * 0.272; // 1.272 ext
  let tp2 = swingEnd + dirSign * swingRange * 0.618; // 1.618 ext
  let tp3 = swingEnd + dirSign * swingRange * 1.0;   // 2.0 ext

  // Safety: if TPs end up on the wrong side of entry, fall back to
  // ATR-like R:R from the actual risk so the order stays placeable.
  const risk = Math.abs(entry - stopLoss);

  if (direction === "long") {
    if (tp1 <= entry) tp1 = entry + risk * 2.0;
    if (tp2 <= tp1) tp2 = entry + risk * 3.5;
    if (tp3 <= tp2) tp3 = entry + risk * 6.0;
  } else {
    if (tp1 >= entry) tp1 = entry - risk * 2.0;
    if (tp2 >= tp1) tp2 = entry - risk * 3.5;
    if (tp3 >= tp2) tp3 = entry - risk * 6.0;
  }

  return { tp1, tp2, tp3 };
}

// ===== MAIN =====

export function buildSignal(
  pair: string,
  timeframe: string,
  candles: Candle[],
  overlays: Overlays,
  verifiedPrice?: VerifiedPrice
): TradingSignal {
  const pipSize = calcPipSize(pair);
  const currentPrice = candles[candles.length - 1].close;
  const timestamp = candles[candles.length - 1].time;

  const notes: string[] = [];
  const sessionInfo = getSession();
  const round = nearestRoundNumber(pair, currentPrice);
  const roundNumberNear = round !== null && round.distancePct < 0.15;

  const priceVerification = verifiedPrice
    ? {
        chartPrice: verifiedPrice.chartPrice,
        yahooPrice: verifiedPrice.yahooPrice,
        diffPct: verifiedPrice.diffPct,
        tolerance: verifiedPrice.tolerance,
        verified: verifiedPrice.ok,
      }
    : undefined;

  const baseConfluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: false, rsiAligned: false, smaAligned: false,
    vwapAligned: false, orderBlockNear: false, fvgNear: false,
    session: sessionInfo.name, sessionFavorable: sessionInfo.favorable,
  };

  if (verifiedPrice && !verifiedPrice.ok) {
    return {
      pair, timeframe, timestamp,
      direction: "neutral", orderType: "none", signalLabel: "NEUTRAL",
      entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
      riskPips: 0, rewardPips: [0, 0, 0], riskReward: ["0", "0", "0"],
      zone: null, entryCandle: null,
      confluences: baseConfluences, confidence: "NEUTRAL", score: 0,
      neutralReason: verifiedPrice.reason || "Price feed not verified",
      notes, priceVerification,
    };
  }

  const zoneCandles: ZoneCandle[] = candles.map((c) => ({
    open: c.open, high: c.high, low: c.low, close: c.close, is_green: c.is_green,
  }));

  const zones = detectZones(zoneCandles);

  if (zones.length === 0) {
    return {
      pair, timeframe, timestamp,
      direction: "neutral", orderType: "none", signalLabel: "NEUTRAL",
      entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
      riskPips: 0, rewardPips: [0, 0, 0], riskReward: ["0", "0", "0"],
      zone: null, entryCandle: null,
      confluences: baseConfluences, confidence: "NEUTRAL", score: 0,
      neutralReason: "No supply/demand zones detected",
      notes, priceVerification,
    };
  }

  // ===== ATR =====
  const atr = calcATR(candles, 14);
  const slDistance = atr * 2.0; // SL = entry ± 2.0 × ATR

  // ===== ZONE SELECTION — price must be INSIDE or within 0.5% of the zone =====
  const sortedZones = [...zones].sort((a, b) => a.distanceToPrice - b.distanceToPrice);

  const activeZone = sortedZones.find((z) => {
    // Inside the zone
    if (currentPrice >= z.bottom && currentPrice <= z.top) return true;

    // Demand zone — price above it, approaching downward
    if (z.type === "demand" && currentPrice > z.top) {
      return ((currentPrice - z.top) / z.top) * 100 <= 0.5;
    }

    // Supply zone — price below it, approaching upward
    if (z.type === "supply" && currentPrice < z.bottom) {
      return ((z.bottom - currentPrice) / z.bottom) * 100 <= 0.5;
    }

    // Otherwise: price is far from the zone → NOT active (no STOP orders)
    return false;
  });

  if (!activeZone) {
    const nearest = sortedZones[0];
    return {
      pair, timeframe, timestamp,
      direction: "neutral", orderType: "none", signalLabel: "NEUTRAL",
      entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
      riskPips: 0, rewardPips: [0, 0, 0], riskReward: ["0", "0", "0"],
      zone: { type: nearest.type, top: nearest.top, bottom: nearest.bottom, strength: 0, distanceToPrice: nearest.distanceToPrice },
      entryCandle: null,
      confluences: baseConfluences, confidence: "NEUTRAL", score: 0,
      neutralReason: `Price is ${(nearest.distanceToPrice).toFixed(5)} away from nearest ${nearest.type} zone — waiting for price to reach it`,
      notes, priceVerification,
    };
  }

  const direction: "long" | "short" = activeZone.type === "demand" ? "long" : "short";
  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(zoneCandles, signalDirection);

  const priceInsideZone = currentPrice >= activeZone.bottom && currentPrice <= activeZone.top;

  // ===== ORDER TYPE — NO STOP ORDERS =====
  let orderType: OrderType;
  let signalLabel: SignalLabel;
  let entryLevel: number;

  if (priceInsideZone && entryCandle.type !== "none") {
    // Inside zone + confirmation → market
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
    entryLevel = currentPrice;
  } else {
    // Either inside zone without confirmation, OR approaching zone
    // → pending limit order at zone edge
    orderType = "limit";
    signalLabel = direction === "long" ? "BUY LIMIT" : "SELL LIMIT";
    entryLevel = direction === "long" ? activeZone.top : activeZone.bottom;
  }

  // ===== SL — ATR-based =====
  const rawSL = direction === "long" ? entryLevel - slDistance : entryLevel + slDistance;

  // ===== TPs — Fibonacci =====
  const fib = computeFibonacciTPs(direction, entryLevel, rawSL, activeZone);

  const riskPips = Math.round(Math.abs(entryLevel - rawSL) / pipSize);
  const rewardPips: [number, number, number] = [
    Math.round(Math.abs(fib.tp1 - entryLevel) / pipSize),
    Math.round(Math.abs(fib.tp2 - entryLevel) / pipSize),
    Math.round(Math.abs(fib.tp3 - entryLevel) / pipSize),
  ];
  const riskReward: [string, string, string] = [
    riskPips > 0 ? (rewardPips[0] / riskPips).toFixed(1) : "0",
    riskPips > 0 ? (rewardPips[1] / riskPips).toFixed(1) : "0",
    riskPips > 0 ? (rewardPips[2] / riskPips).toFixed(1) : "0",
  ];

  const confluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: checkSupertrendAligned(overlays, direction),
    rsiAligned: checkRSIAligned(overlays, direction),
    smaAligned: checkSMAAligned(overlays, direction),
    vwapAligned: checkVWAPAligned(overlays, currentPrice, direction),
    orderBlockNear: checkOrderBlockNear(overlays, currentPrice, direction),
    fvgNear: checkFVGNear(overlays, currentPrice, direction),
    session: sessionInfo.name,
    sessionFavorable: sessionInfo.favorable,
  };

  let score = entryCandle.probability || 50;
  if (confluences.supertrendAligned) score += 5;
  if (confluences.rsiAligned) score += 5;
  if (confluences.smaAligned) score += 5;
  if (confluences.vwapAligned) score += 5;
  if (confluences.orderBlockNear) score += 5;
  if (confluences.fvgNear) score += 5;
  if (confluences.roundNumber) score += 5;
  if (confluences.sessionFavorable) score += 10;
  score = Math.min(score, 100);

  const confidence: Confidence = score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 35 ? "LOW" : "NEUTRAL";

  notes.push(`Zone: ${activeZone.type} ${activeZone.bottom.toFixed(5)} - ${activeZone.top.toFixed(5)}`);
  notes.push(`Current price: ${currentPrice.toFixed(5)}`);
  notes.push(`ATR(14): ${atr.toFixed(5)} | SL distance: ${slDistance.toFixed(5)} (2.0 × ATR)`);
  notes.push(`Entry (${signalLabel}): ${entryLevel.toFixed(5)}`);
  notes.push(`SL: ${rawSL.toFixed(5)} — risk ${riskPips} pips`);
  notes.push(`TPs: Fibonacci 1.272 / 1.618 / 2.0 of swing`);
  notes.push(`Session: ${sessionInfo.name}`);

  return {
    pair, timeframe, timestamp,
    direction, orderType, signalLabel,
    entry: entryLevel,
    stopLoss: rawSL,
    takeProfit1: fib.tp1,
    takeProfit2: fib.tp2,
    takeProfit3: fib.tp3,
    riskPips, rewardPips, riskReward,
    zone: { type: activeZone.type, top: activeZone.top, bottom: activeZone.bottom, strength: 0, distanceToPrice: activeZone.distanceToPrice },
    entryCandle: {
      type: entryCandle.type === "large_range_candle" ? "large_range" : entryCandle.type,
      direction: entryCandle.direction,
      probability: entryCandle.probability,
      reason: entryCandle.reason,
    },
    confluences, confidence, score, notes,
    priceVerification,
  };
}