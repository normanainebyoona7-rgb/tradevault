// src/lib/signal.ts
// Signal orchestrator — ATR-based SL, risk-multiple TPs, limit/market orders only.
//
// SL: entry ± 2.0 × ATR(14)
// TPs: TP1 = 1.0 × risk, TP2 = 1.5 × risk, TP3 = 3.0 × risk
//      (risk = |entry - stopLoss|)
//
// NEUTRAL: when there is no valid zone, or price is inside a zone without
// confirmation, we return direction = "neutral" and signalLabel = "NEUTRAL".
// Callers MUST treat neutral as "no trade" — do not save, do not post.
//
// Orders: BUY, SELL, BUY LIMIT, SELL LIMIT only.

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
export type OrderType = "market" | "limit";
export type SignalLabel = "BUY" | "SELL" | "BUY LIMIT" | "SELL LIMIT" | "NEUTRAL";
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
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskPips: number;
  rewardPips: [number, number, number];
  riskReward: [string, string, string];
  zone: SignalZone | null;
  entryCandle: SignalEntryCandle;
  confluences: SignalConfluences;
  confidence: Confidence;
  score: number;
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

function calcATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
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

// ===== TPs — risk multiples =====
function computeTakeProfits(
  direction: "long" | "short",
  entry: number,
  stopLoss: number
): { tp1: number; tp2: number; tp3: number } {
  const risk = Math.abs(entry - stopLoss);
  const sign = direction === "long" ? 1 : -1;

  return {
    tp1: entry + sign * risk * 1.0,
    tp2: entry + sign * risk * 1.5,
    tp3: entry + sign * risk * 3.0,
  };
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

  const zoneCandles: ZoneCandle[] = candles.map((c) => ({
    open: c.open, high: c.high, low: c.low, close: c.close, is_green: c.is_green,
  }));

  const zones = detectZones(zoneCandles);
  const atr = calcATR(candles, 14);

  const neutralConfluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: false, rsiAligned: false, smaAligned: false,
    vwapAligned: false, orderBlockNear: false, fvgNear: false,
    session: sessionInfo.name, sessionFavorable: sessionInfo.favorable,
  };

  // ---- NO ZONES → NEUTRAL ----
  if (zones.length === 0) {
    notes.push("No supply/demand zones detected.");
    notes.push("Neutral — no trade. No signal saved.");
    notes.push(`Current price: ${currentPrice.toFixed(5)} | ATR(14): ${atr.toFixed(5)}`);
    return {
      pair, timeframe, timestamp,
      direction: "neutral",
      orderType: "market",
      signalLabel: "NEUTRAL",
      entry: currentPrice,
      stopLoss: currentPrice,
      takeProfit1: currentPrice,
      takeProfit2: currentPrice,
      takeProfit3: currentPrice,
      riskPips: 0,
      rewardPips: [0, 0, 0],
      riskReward: ["0", "0", "0"],
      zone: null,
      entryCandle: {
        type: "none",
        direction: "bullish",
        probability: 0,
        reason: "No zone on chart — no setup.",
      },
      confluences: neutralConfluences,
      confidence: "NEUTRAL",
      score: 0,
      notes,
      priceVerification,
    };
  }

  const slDistance = atr * 2.0;

  // ===== ZONE SELECTION =====
  const sortedZones = [...zones].sort((a, b) => a.distanceToPrice - b.distanceToPrice);

  const insideZone = sortedZones.find(
    (z) => currentPrice >= z.bottom && currentPrice <= z.top
  );

  const correctSideZone = sortedZones.find((z) => {
    if (z.type === "demand" && z.top < currentPrice) return true;
    if (z.type === "supply" && z.bottom > currentPrice) return true;
    return false;
  });

  const fallbackZone = sortedZones[0];

  const activeZone: SupplyDemandZone = insideZone ?? correctSideZone ?? fallbackZone;

  const direction: "long" | "short" = activeZone.type === "demand" ? "long" : "short";
  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(zoneCandles, signalDirection);

  const priceInsideZone = currentPrice >= activeZone.bottom && currentPrice <= activeZone.top;

  // ---- INSIDE ZONE WITHOUT CONFIRMATION → NEUTRAL ----
  if (priceInsideZone && entryCandle.type === "none") {
    notes.push(
      `Price is inside ${activeZone.type} zone ${activeZone.bottom.toFixed(5)} - ${activeZone.top.toFixed(5)}.`
    );
    notes.push("No confirmation candle (LRC / Engulfing / Pin Bar).");
    notes.push("Neutral — waiting for confirmation. No signal saved.");
    return {
      pair, timeframe, timestamp,
      direction: "neutral",
      orderType: "market",
      signalLabel: "NEUTRAL",
      entry: currentPrice,
      stopLoss: currentPrice,
      takeProfit1: currentPrice,
      takeProfit2: currentPrice,
      takeProfit3: currentPrice,
      riskPips: 0,
      rewardPips: [0, 0, 0],
      riskReward: ["0", "0", "0"],
      zone: {
        type: activeZone.type,
        top: activeZone.top,
        bottom: activeZone.bottom,
        strength: 0,
        distanceToPrice: activeZone.distanceToPrice,
      },
      entryCandle: {
        type: "none",
        direction: entryCandle.direction,
        probability: entryCandle.probability,
        reason: entryCandle.reason,
      },
      confluences: neutralConfluences,
      confidence: "NEUTRAL",
      score: 0,
      notes,
      priceVerification,
    };
  }

  // ===== ORDER TYPE =====
  let orderType: OrderType;
  let signalLabel: SignalLabel;
  let entryLevel: number;

  if (priceInsideZone && entryCandle.type !== "none") {
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
    entryLevel = currentPrice;
  } else {
    orderType = "limit";
    signalLabel = direction === "long" ? "BUY LIMIT" : "SELL LIMIT";

    if (direction === "long") {
      if (activeZone.top < currentPrice) {
        entryLevel = activeZone.top;
      } else if (activeZone.bottom < currentPrice) {
        entryLevel = activeZone.bottom;
      } else {
        entryLevel = currentPrice - Math.max(slDistance, (activeZone.bottom - currentPrice) + slDistance);
      }
    } else {
      if (activeZone.bottom > currentPrice) {
        entryLevel = activeZone.bottom;
      } else if (activeZone.top > currentPrice) {
        entryLevel = activeZone.top;
      } else {
        entryLevel = currentPrice + Math.max(slDistance, (currentPrice - activeZone.top) + slDistance);
      }
    }

    if (direction === "long" && entryLevel >= currentPrice) {
      entryLevel = currentPrice - slDistance;
    }
    if (direction === "short" && entryLevel <= currentPrice) {
      entryLevel = currentPrice + slDistance;
    }
  }

  // ===== SL =====
  const rawSL = direction === "long" ? entryLevel - slDistance : entryLevel + slDistance;

  // ===== TPs =====
  const tp = computeTakeProfits(direction, entryLevel, rawSL);

  const riskPips = Math.round(Math.abs(entryLevel - rawSL) / pipSize);
  const rewardPips: [number, number, number] = [
    Math.round(Math.abs(tp.tp1 - entryLevel) / pipSize),
    Math.round(Math.abs(tp.tp2 - entryLevel) / pipSize),
    Math.round(Math.abs(tp.tp3 - entryLevel) / pipSize),
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

  const confidence: Confidence = score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : "LOW";

  notes.push(`Zone: ${activeZone.type} ${activeZone.bottom.toFixed(5)} - ${activeZone.top.toFixed(5)}`);
  notes.push(`Current price: ${currentPrice.toFixed(5)}`);
  notes.push(`ATR(14): ${atr.toFixed(5)} | SL distance: ${slDistance.toFixed(5)} (2.0 × ATR)`);
  notes.push(`Entry (${signalLabel}): ${entryLevel.toFixed(5)}`);
  notes.push(`SL: ${rawSL.toFixed(5)} — risk ${riskPips} pips`);
  notes.push(`TPs: 1.0× / 1.5× / 3.0× risk (R:R 1:1 / 1:1.5 / 1:3)`);
  notes.push(`Session: ${sessionInfo.name}`);
  if (orderType === "limit") {
    notes.push(
      direction === "long"
        ? `Limit placed ${((currentPrice - entryLevel) / pipSize).toFixed(1)} pips BELOW market`
        : `Limit placed ${((entryLevel - currentPrice) / pipSize).toFixed(1)} pips ABOVE market`
    );
  }

  return {
    pair, timeframe, timestamp,
    direction, orderType, signalLabel,
    entry: entryLevel,
    stopLoss: rawSL,
    takeProfit1: tp.tp1,
    takeProfit2: tp.tp2,
    takeProfit3: tp.tp3,
    riskPips, rewardPips, riskReward,
    zone: {
      type: activeZone.type,
      top: activeZone.top,
      bottom: activeZone.bottom,
      strength: 0,
      distanceToPrice: activeZone.distanceToPrice,
    },
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