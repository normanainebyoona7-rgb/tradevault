// src/lib/signal.ts
// Signal orchestrator with TIGHT SL (Option A).
//
// SL RULES:
//   long:  SL = entry - buffer  (always below entry, tight)
//   short: SL = entry + buffer  (always above entry, tight)
//   buffer = max(0.1 × avg candle range, minimum pips for pair)
//
// This means: SL is a fixed small distance from entry, NOT at the zone
// bottom/top. Risk stays small (30-50 pips on gold, 15-30 on forex).
//
// Order type is chosen based on where price sits relative to the zone:
//   BUY LIMIT  — must be BELOW current price
//   SELL LIMIT — must be ABOVE current price
//   BUY STOP   — must be ABOVE current price
//   SELL STOP  — must be BELOW current price
//   BUY / SELL — market, at current price
// Impossible orders are auto-converted to the valid counterpart.

import type { Candle } from "@/lib/data/candles";
import type { Overlays } from "@/lib/overlays";
import {
  detectZones,
  detectEntrySignal,
  type ZoneCandle,
  type SupplyDemandZone,
} from "@/lib/zone-strategy";

// ===== TYPES =====

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

// ===== ORDER TYPE SELECTION =====
function selectOrderType(
  direction: "long" | "short",
  currentPrice: number,
  zone: SupplyDemandZone,
  entryCandleType: string
): { orderType: OrderType; signalLabel: SignalLabel; entryLevel: number } {
  const priceInsideZone = currentPrice >= zone.bottom && currentPrice <= zone.top;
  const priceAboveZone = currentPrice > zone.top;
  const priceBelowZone = currentPrice < zone.bottom;

  let orderType: OrderType;
  let signalLabel: SignalLabel;
  let entryLevel: number;

  if (direction === "long") {
    if (priceInsideZone) {
      if (entryCandleType !== "none") {
        orderType = "market";
        signalLabel = "BUY";
        entryLevel = currentPrice;
      } else {
        orderType = "limit";
        signalLabel = "BUY LIMIT";
        entryLevel = zone.top;
      }
    } else if (priceAboveZone) {
      orderType = "limit";
      signalLabel = "BUY LIMIT";
      entryLevel = zone.top;
    } else {
      orderType = "stop";
      signalLabel = "BUY STOP";
      entryLevel = zone.top;
    }
  } else {
    if (priceInsideZone) {
      if (entryCandleType !== "none") {
        orderType = "market";
        signalLabel = "SELL";
        entryLevel = currentPrice;
      } else {
        orderType = "limit";
        signalLabel = "SELL LIMIT";
        entryLevel = zone.bottom;
      }
    } else if (priceBelowZone) {
      orderType = "limit";
      signalLabel = "SELL LIMIT";
      entryLevel = zone.bottom;
    } else {
      orderType = "stop";
      signalLabel = "SELL STOP";
      entryLevel = zone.bottom;
    }
  }

  return { orderType, signalLabel, entryLevel };
}

// ===== ORDER VALIDATION =====
function validateOrderAgainstPrice(
  orderType: OrderType,
  signalLabel: SignalLabel,
  direction: "long" | "short",
  entryLevel: number,
  currentPrice: number
): { orderType: OrderType; signalLabel: SignalLabel } {
  if (orderType === "market" || orderType === "none") {
    return { orderType, signalLabel };
  }

  if (direction === "long") {
    if (orderType === "limit" && entryLevel >= currentPrice) {
      return { orderType: "stop", signalLabel: "BUY STOP" };
    }
    if (orderType === "stop" && entryLevel <= currentPrice) {
      return { orderType: "limit", signalLabel: "BUY LIMIT" };
    }
  } else {
    if (orderType === "limit" && entryLevel <= currentPrice) {
      return { orderType: "stop", signalLabel: "SELL STOP" };
    }
    if (orderType === "stop" && entryLevel >= currentPrice) {
      return { orderType: "limit", signalLabel: "SELL LIMIT" };
    }
  }

  return { orderType, signalLabel };
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

  // Buffer = TIGHT — this is the SL distance from entry
  const avgRange = candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / 20;
  const minBufferPrice = minBufferPips(pair) * pipSize;
  const buffer = Math.max(avgRange * 0.1, minBufferPrice);

  const activeZone = sortedZones.find((z) => {
    if (currentPrice >= z.bottom && currentPrice <= z.top) return true;
    if (z.type === "demand" && currentPrice > z.top) {
      const pct = ((currentPrice - z.top) / z.top) * 100;
      return pct <= 0.5;
    }
    if (z.type === "supply" && currentPrice < z.bottom) {
      const pct = ((z.bottom - currentPrice) / z.bottom) * 100;
      return pct <= 0.5;
    }
    if (z.type === "demand" && currentPrice < z.bottom) {
      const pct = ((z.bottom - currentPrice) / z.bottom) * 100;
      return pct <= 0.5;
    }
    if (z.type === "supply" && currentPrice > z.top) {
      const pct = ((currentPrice - z.top) / z.top) * 100;
      return pct <= 0.5;
    }
    return false;
  });

  if (!activeZone) {
    const nearest = sortedZones[0];
    return {
      pair, timeframe, timestamp,
      direction: "neutral", orderType: "none", signalLabel: "NEUTRAL",
      entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
      riskPips: 0, rewardPips: [0, 0, 0], riskReward: ["0", "0", "0"],
      zone: {
        type: nearest.type, top: nearest.top, bottom: nearest.bottom,
        strength: 0, distanceToPrice: nearest.distanceToPrice,
      },
      entryCandle: null,
      confluences: baseConfluences, confidence: "NEUTRAL", score: 0,
      neutralReason: `Price not at zone. Nearest ${nearest.type} at ${nearest.bottom.toFixed(5)} - ${nearest.top.toFixed(5)}`,
      notes,
    };
  }

  const direction: "long" | "short" = activeZone.type === "demand" ? "long" : "short";
  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(zoneCandles, signalDirection);

  // ===== SELECT ORDER TYPE =====
  const initial = selectOrderType(direction, currentPrice, activeZone, entryCandle.type);
  const validated = validateOrderAgainstPrice(
    initial.orderType,
    initial.signalLabel,
    direction,
    initial.entryLevel,
    currentPrice
  );

  const orderType = validated.orderType;
  const signalLabel = validated.signalLabel;
  const entryLevel = initial.entryLevel;

  // ===== SL — TIGHT (Option A) =====
  // SL is a fixed small distance from entry, NOT at the zone bottom/top.
  let rawSL: number;
  if (direction === "long") {
    rawSL = entryLevel - buffer;  // below entry
  } else {
    rawSL = entryLevel + buffer;  // above entry
  }

  // ===== TPs =====
  const rawRisk = Math.abs(entryLevel - rawSL);
  let rawTP1: number, rawTP2: number, rawTP3: number;
  if (direction === "long") {
    rawTP1 = entryLevel + rawRisk * 2.0;
    rawTP2 = entryLevel + rawRisk * 3.5;
    rawTP3 = entryLevel + rawRisk * 6.0;
  } else {
    rawTP1 = entryLevel - rawRisk * 2.0;
    rawTP2 = entryLevel - rawRisk * 3.5;
    rawTP3 = entryLevel - rawRisk * 6.0;
  }

  const riskPips = Math.round(rawRisk / pipSize);
  const rewardPips: [number, number, number] = [
    Math.round(Math.abs(rawTP1 - entryLevel) / pipSize),
    Math.round(Math.abs(rawTP2 - entryLevel) / pipSize),
    Math.round(Math.abs(rawTP3 - entryLevel) / pipSize),
  ];
  const riskReward: [string, string, string] = [
    riskPips > 0 ? (rewardPips[0] / riskPips).toFixed(1) : "0",
    riskPips > 0 ? (rewardPips[1] / riskPips).toFixed(1) : "0",
    riskPips > 0 ? (rewardPips[2] / riskPips).toFixed(1) : "0",
  ];

  // ===== CONFLUENCE SCORING =====
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
  notes.push(`Entry (${signalLabel}): ${entryLevel.toFixed(5)}`);
  notes.push(`SL: ${rawSL.toFixed(5)} (risk ${riskPips} pips — tight)`);
  if (entryCandle.type !== "none") {
    notes.push(`Entry signal: ${entryCandle.reason} (${entryCandle.probability}%)`);
  }
  if (confluences.supertrendAligned) notes.push("Supertrend aligned ✅");
  if (confluences.rsiAligned) notes.push("RSI aligned ✅");
  if (confluences.smaAligned) notes.push("SMA aligned ✅");
  if (confluences.vwapAligned) notes.push("VWAP aligned ✅");
  if (confluences.orderBlockNear) notes.push("Order block nearby ✅");
  if (confluences.fvgNear) notes.push("FVG nearby ✅");
  if (confluences.roundNumber && round) {
    notes.push(`Near round number ${round.level} (${round.distancePct.toFixed(2)}%)`);
  }
  notes.push(`Session: ${sessionInfo.name}`);

  return {
    pair, timeframe, timestamp,
    direction, orderType, signalLabel,
    entry: entryLevel,
    stopLoss: rawSL,
    takeProfit1: rawTP1,
    takeProfit2: rawTP2,
    takeProfit3: rawTP3,
    riskPips, rewardPips, riskReward,
    zone: {
      type: activeZone.type, top: activeZone.top, bottom: activeZone.bottom,
      strength: 0, distanceToPrice: activeZone.distanceToPrice,
    },
    entryCandle: {
      type: entryCandle.type === "large_range_candle" ? "large_range" : entryCandle.type,
      direction: entryCandle.direction,
      probability: entryCandle.probability,
      reason: entryCandle.reason,
    },
    confluences, confidence, score, notes,
  };
}