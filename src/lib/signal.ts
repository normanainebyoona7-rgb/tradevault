// src/lib/signal.ts
// Signal orchestrator. Every directional setup produces a tradeable signal.
// No null entries — if a zone is found, you get BUY / SELL / BUY LIMIT /
// SELL LIMIT / BUY STOP / SELL STOP, never NEUTRAL.
//
// Rules:
//   - Price INSIDE zone + confirmation candle → BUY / SELL (market)
//   - Price INSIDE zone, no confirmation      → BUY LIMIT / SELL LIMIT
//   - Price APPROACHING zone (within 0.5%)    → BUY LIMIT / SELL LIMIT
//   - Price BOUNCED off zone, valid stop      → BUY STOP / SELL STOP
//   - Nothing valid                           → NEUTRAL
//
// Side enforcement: long → SL < entry < TPs. short → TPs < entry < SL.

import type { Candle } from "@/lib/data/candles";
import type { Overlays } from "@/lib/overlays";
import {
  detectZones,
  detectEntrySignal,
  type ZoneCandle,
  type SupplyDemandZone,
} from "@/lib/zone-strategy";

export type SignalDirection = "long" | "short" | "neutral";
export type OrderType = "market" | "limit" | "stop" | "none";
export type SignalLabel =
  | "BUY" | "SELL" | "BUY LIMIT" | "SELL LIMIT"
  | "BUY STOP" | "SELL STOP" | "NEUTRAL";
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
}

function calcPipSize(pair: string): number {
  if (pair.includes("XAU")) return 0.10;
  if (pair.includes("XAG")) return 0.01;
  if (pair.includes("BTC")) return 1.00;
  if (pair.includes("ETH")) return 0.10;
  const [, quote] = pair.split("/");
  if (quote === "JPY") return 0.01;
  return 0.0001;
}

function minBufferPips(pair: string): number {
  if (pair.includes("XAU")) return 30;
  if (pair.includes("XAG")) return 3;
  if (pair.includes("BTC")) return 100;
  if (pair.includes("ETH")) return 10;
  if (pair.includes("JPY")) return 5;
  return 5;
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

function detectDemandBounce(
  candles: Candle[],
  zone: SupplyDemandZone,
  lookback: number = 20
): boolean {
  const recent = candles.slice(-lookback);
  const offset = candles.length - recent.length;
  let touchIndex = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    const c = recent[i];
    if (c.low <= zone.top && c.high >= zone.bottom) {
      touchIndex = i + offset;
      break;
    }
  }
  if (touchIndex === -1) return false;
  for (let i = touchIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (c.is_green && c.close > zone.top) return true;
  }
  return false;
}

function detectSupplyBounce(
  candles: Candle[],
  zone: SupplyDemandZone,
  lookback: number = 20
): boolean {
  const recent = candles.slice(-lookback);
  const offset = candles.length - recent.length;
  let touchIndex = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    const c = recent[i];
    if (c.high >= zone.bottom && c.low <= zone.top) {
      touchIndex = i + offset;
      break;
    }
  }
  if (touchIndex === -1) return false;
  for (let i = touchIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (!c.is_green && c.close < zone.bottom) return true;
  }
  return false;
}

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

// ===== SIDE ENFORCEMENT =====
function enforceCorrectSides(
  direction: "long" | "short",
  entry: number,
  stopLoss: number,
  tp1: number,
  tp2: number,
  tp3: number,
  pipSize: number
): { entry: number; stopLoss: number; tp1: number; tp2: number; tp3: number } {
  const minRisk = 5 * pipSize;

  if (direction === "long") {
    if (stopLoss >= entry) {
      stopLoss = entry - Math.max(Math.abs(entry - stopLoss), minRisk);
    }
    const risk = entry - stopLoss;
    let e1 = tp1, e2 = tp2, e3 = tp3;
    if (e1 <= entry) e1 = entry + risk * 2.0;
    if (e2 <= e1) e2 = entry + risk * 3.5;
    if (e3 <= e2) e3 = entry + risk * 6.0;
    return { entry, stopLoss, tp1: e1, tp2: e2, tp3: e3 };
  } else {
    if (stopLoss <= entry) {
      stopLoss = entry + Math.max(Math.abs(stopLoss - entry), minRisk);
    }
    const risk = stopLoss - entry;
    let e1 = tp1, e2 = tp2, e3 = tp3;
    if (e1 >= entry) e1 = entry - risk * 2.0;
    if (e2 >= e1) e2 = entry - risk * 3.5;
    if (e3 >= e2) e3 = entry - risk * 6.0;
    return { entry, stopLoss, tp1: e1, tp2: e2, tp3: e3 };
  }
}

// ===== MAIN =====
export function buildSignal(
  pair: string,
  timeframe: string,
  candles: Candle[],
  overlays: Overlays
): TradingSignal {
  const pipSize = calcPipSize(pair);
  const currentPrice = candles[candles.length - 1].close;
  const timestamp = candles[candles.length - 1].time;

  const notes: string[] = [];
  const sessionInfo = getSession();
  const round = nearestRoundNumber(pair, currentPrice);
  const roundNumberNear = round !== null && round.distancePct < 0.15;

  const baseConfluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: false,
    rsiAligned: false,
    smaAligned: false,
    vwapAligned: false,
    orderBlockNear: false,
    fvgNear: false,
    session: sessionInfo.name,
    sessionFavorable: sessionInfo.favorable,
  };

  const zoneCandles: ZoneCandle[] = candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    is_green: c.is_green,
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
      notes,
    };
  }

  const sortedZones = [...zones].sort((a, b) => a.distanceToPrice - b.distanceToPrice);

  const avgRange = candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / 20;
  const minBufferPrice = minBufferPips(pair) * pipSize;
  const buffer = Math.max(avgRange * 0.1, minBufferPrice);

  // ===== SCAN FOR BOUNCE SETUPS =====
  for (const zone of sortedZones) {
    if (zone.type === "demand") {
      if (!detectDemandBounce(candles, zone)) continue;

      const pctAbove = ((currentPrice - zone.top) / zone.top) * 100;
      const entryLevel = zone.top + buffer;
      const canPlaceStop = entryLevel > currentPrice && currentPrice > zone.top && pctAbove <= 0.5;
      if (!canPlaceStop) continue;

      const rawSL = zone.bottom - buffer;
      const rawRisk = Math.abs(entryLevel - rawSL);
      const fixed = enforceCorrectSides(
        "long", entryLevel, rawSL,
        entryLevel + rawRisk * 2.0,
        entryLevel + rawRisk * 3.5,
        entryLevel + rawRisk * 6.0,
        pipSize
      );

      const riskPips = Math.round(Math.abs(fixed.entry - fixed.stopLoss) / pipSize);
      const rewardPips: [number, number, number] = [
        Math.round(Math.abs(fixed.tp1 - fixed.entry) / pipSize),
        Math.round(Math.abs(fixed.tp2 - fixed.entry) / pipSize),
        Math.round(Math.abs(fixed.tp3 - fixed.entry) / pipSize),
      ];
      const riskReward: [string, string, string] = [
        riskPips > 0 ? (rewardPips[0] / riskPips).toFixed(1) : "0",
        riskPips > 0 ? (rewardPips[1] / riskPips).toFixed(1) : "0",
        riskPips > 0 ? (rewardPips[2] / riskPips).toFixed(1) : "0",
      ];

      const confluences: SignalConfluences = {
        roundNumber: roundNumberNear,
        supertrendAligned: checkSupertrendAligned(overlays, "long"),
        rsiAligned: checkRSIAligned(overlays, "long"),
        smaAligned: checkSMAAligned(overlays, "long"),
        vwapAligned: checkVWAPAligned(overlays, currentPrice, "long"),
        orderBlockNear: checkOrderBlockNear(overlays, currentPrice, "long"),
        fvgNear: checkFVGNear(overlays, currentPrice, "long"),
        session: sessionInfo.name,
        sessionFavorable: sessionInfo.favorable,
      };
      let score = 70;
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

      notes.push(`Demand bounce — BUY STOP at ${fixed.entry.toFixed(5)}`);

      return {
        pair, timeframe, timestamp,
        direction: "long", orderType: "stop", signalLabel: "BUY STOP",
        entry: fixed.entry, stopLoss: fixed.stopLoss,
        takeProfit1: fixed.tp1, takeProfit2: fixed.tp2, takeProfit3: fixed.tp3,
        riskPips, rewardPips, riskReward,
        zone: { type: zone.type, top: zone.top, bottom: zone.bottom, strength: 0, distanceToPrice: zone.distanceToPrice },
        entryCandle: { type: "large_range", direction: "bullish", probability: 70, reason: "Demand bounce confirmed" },
        confluences, confidence, score, notes,
      };
    } else {
      if (!detectSupplyBounce(candles, zone)) continue;

      const pctBelow = ((zone.bottom - currentPrice) / zone.bottom) * 100;
      const entryLevel = zone.bottom - buffer;
      const canPlaceStop = entryLevel < currentPrice && currentPrice < zone.bottom && pctBelow <= 0.5;
      if (!canPlaceStop) continue;

      const rawSL = zone.top + buffer;
      const rawRisk = Math.abs(entryLevel - rawSL);
      const fixed = enforceCorrectSides(
        "short", entryLevel, rawSL,
        entryLevel - rawRisk * 2.0,
        entryLevel - rawRisk * 3.5,
        entryLevel - rawRisk * 6.0,
        pipSize
      );

      const riskPips = Math.round(Math.abs(fixed.stopLoss - fixed.entry) / pipSize);
      const rewardPips: [number, number, number] = [
        Math.round(Math.abs(fixed.entry - fixed.tp1) / pipSize),
        Math.round(Math.abs(fixed.entry - fixed.tp2) / pipSize),
        Math.round(Math.abs(fixed.entry - fixed.tp3) / pipSize),
      ];
      const riskReward: [string, string, string] = [
        riskPips > 0 ? (rewardPips[0] / riskPips).toFixed(1) : "0",
        riskPips > 0 ? (rewardPips[1] / riskPips).toFixed(1) : "0",
        riskPips > 0 ? (rewardPips[2] / riskPips).toFixed(1) : "0",
      ];

      const confluences: SignalConfluences = {
        roundNumber: roundNumberNear,
        supertrendAligned: checkSupertrendAligned(overlays, "short"),
        rsiAligned: checkRSIAligned(overlays, "short"),
        smaAligned: checkSMAAligned(overlays, "short"),
        vwapAligned: checkVWAPAligned(overlays, currentPrice, "short"),
        orderBlockNear: checkOrderBlockNear(overlays, currentPrice, "short"),
        fvgNear: checkFVGNear(overlays, currentPrice, "short"),
        session: sessionInfo.name,
        sessionFavorable: sessionInfo.favorable,
      };
      let score = 70;
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

      notes.push(`Supply bounce — SELL STOP at ${fixed.entry.toFixed(5)}`);

      return {
        pair, timeframe, timestamp,
        direction: "short", orderType: "stop", signalLabel: "SELL STOP",
        entry: fixed.entry, stopLoss: fixed.stopLoss,
        takeProfit1: fixed.tp1, takeProfit2: fixed.tp2, takeProfit3: fixed.tp3,
        riskPips, rewardPips, riskReward,
        zone: { type: zone.type, top: zone.top, bottom: zone.bottom, strength: 0, distanceToPrice: zone.distanceToPrice },
        entryCandle: { type: "large_range", direction: "bearish", probability: 70, reason: "Supply bounce confirmed" },
        confluences, confidence, score, notes,
      };
    }
  }

  // ===== LIMIT / MARKET / NEUTRAL FALLBACK =====
  const activeZone = sortedZones.find((z) => {
    if (z.type === "demand" && currentPrice < z.bottom) return false;
    if (z.type === "supply" && currentPrice > z.top) return false;
    return (z.distanceToPrice / currentPrice) * 100 <= 0.5;
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
      neutralReason: `Price not at zone. Nearest ${nearest.type} at ${nearest.bottom.toFixed(5)} - ${nearest.top.toFixed(5)}`,
      notes,
    };
  }

  const direction: "long" | "short" = activeZone.type === "demand" ? "long" : "short";
  const priceInsideZone = currentPrice >= activeZone.bottom && currentPrice <= activeZone.top;
  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(zoneCandles, signalDirection);

  let orderType: OrderType;
  let signalLabel: SignalLabel;

  if (priceInsideZone && entryCandle.type !== "none") {
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
  } else {
    // Either inside zone without confirmation, or approaching zone — both give LIMIT
    orderType = "limit";
    signalLabel = direction === "long" ? "BUY LIMIT" : "SELL LIMIT";
  }

  // ===== ENTRY =====
  let rawEntry: number;
  if (orderType === "limit") {
    // Limit entry = the zone edge price approaches from
    rawEntry = direction === "long" ? activeZone.top : activeZone.bottom;
  } else {
    rawEntry = currentPrice;
  }

  // ===== SL =====
  let rawSL: number;
  if (direction === "long") {
    rawSL = Math.min(activeZone.bottom - buffer, rawEntry - buffer);
  } else {
    rawSL = Math.max(activeZone.top + buffer, rawEntry + buffer);
  }

  // ===== TPs =====
  const rawRisk = Math.abs(rawEntry - rawSL);
  let rawTP1: number, rawTP2: number, rawTP3: number;
  if (direction === "long") {
    rawTP1 = rawEntry + rawRisk * 2.0;
    rawTP2 = rawEntry + rawRisk * 3.5;
    rawTP3 = rawEntry + rawRisk * 6.0;
  } else {
    rawTP1 = rawEntry - rawRisk * 2.0;
    rawTP2 = rawEntry - rawRisk * 3.5;
    rawTP3 = rawEntry - rawRisk * 6.0;
  }

  const fixed = enforceCorrectSides(direction, rawEntry, rawSL, rawTP1, rawTP2, rawTP3, pipSize);

  const riskPips = Math.round(Math.abs(fixed.entry - fixed.stopLoss) / pipSize);
  const rewardPips: [number, number, number] = [
    Math.round(Math.abs(fixed.tp1 - fixed.entry) / pipSize),
    Math.round(Math.abs(fixed.tp2 - fixed.entry) / pipSize),
    Math.round(Math.abs(fixed.tp3 - fixed.entry) / pipSize),
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
  notes.push(`Entry (${signalLabel}): ${fixed.entry.toFixed(5)}`);
  notes.push(`SL: ${fixed.stopLoss.toFixed(5)} (risk ${riskPips} pips)`);

  return {
    pair, timeframe, timestamp,
    direction, orderType, signalLabel,
    entry: fixed.entry, stopLoss: fixed.stopLoss,
    takeProfit1: fixed.tp1, takeProfit2: fixed.tp2, takeProfit3: fixed.tp3,
    riskPips, rewardPips, riskReward,
    zone: { type: activeZone.type, top: activeZone.top, bottom: activeZone.bottom, strength: 0, distanceToPrice: activeZone.distanceToPrice },
    entryCandle: {
      type: entryCandle.type === "large_range_candle" ? "large_range" : entryCandle.type,
      direction: entryCandle.direction,
      probability: entryCandle.probability,
      reason: entryCandle.reason,
    },
    confluences, confidence, score, notes,
  };
}