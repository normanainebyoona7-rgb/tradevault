// src/lib/signal.ts
// Signal orchestrator.
// Direction/entry/SL/TP come from zone-strategy.ts (pure S/D).
// Confluence scoring reads overlays (Supertrend, RSI, SMA, VWAP, OB, FVG).
//
// Order types:
//   - BUY / SELL              → price at zone + confirmation (market)
//   - BUY LIMIT / SELL LIMIT  → price approaching zone (limit)
//   - BUY STOP / SELL STOP    → price bounced off zone AND stop level is valid
//   - NEUTRAL                 → no setup, price between zones, zone failed,
//                                or stop level is on the wrong side of price
//
// STOP ORDER VALIDATION (Option A):
//   A SELL STOP entry must be BELOW current price.
//   A BUY STOP entry must be ABOVE current price.
//   If price has already run past the stop level, the setup is missed.
//   Do NOT fire the stop — return NEUTRAL instead.
//
// SL placement rules (per cheat sheet Part 5):
//   - Long:  SL = zone.bottom - buffer
//   - Short: SL = zone.top    + buffer
//   - buffer = max(0.1×avgRange, minimum pips for pair)
//   - SL is guaranteed on the correct side of entry

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
  | "BUY"
  | "SELL"
  | "BUY LIMIT"
  | "SELL LIMIT"
  | "BUY STOP"
  | "SELL STOP"
  | "NEUTRAL";
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

  if (hour >= 7 && hour <= 11)
    return { name: "LONDON", favorable: true };
  if (hour >= 12 && hour <= 16)
    return { name: "LONDON-NY OVERLAP", favorable: true };
  if (hour >= 17 && hour <= 21)
    return { name: "NEW YORK", favorable: true };
  if (hour >= 0 && hour <= 6)
    return { name: "ASIAN", favorable: false };

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
  const distancePct = (distance / price) * 100;

  return { level: nearest, distancePct };
}

// ===== BOUNCE DETECTION =====

function detectDemandBounce(
  candles: Candle[],
  zone: SupplyDemandZone,
  lookback: number = 20
): { bounced: boolean; touchIndex: number; breakIndex: number } {
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

  if (touchIndex === -1) {
    return { bounced: false, touchIndex: -1, breakIndex: -1 };
  }

  let breakIndex = -1;

  for (let i = touchIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (c.is_green && c.close > zone.top) {
      breakIndex = i;
      break;
    }
  }

  return {
    bounced: breakIndex !== -1,
    touchIndex,
    breakIndex,
  };
}

function detectSupplyBounce(
  candles: Candle[],
  zone: SupplyDemandZone,
  lookback: number = 20
): { bounced: boolean; touchIndex: number; breakIndex: number } {
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

  if (touchIndex === -1) {
    return { bounced: false, touchIndex: -1, breakIndex: -1 };
  }

  let breakIndex = -1;

  for (let i = touchIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (!c.is_green && c.close < zone.bottom) {
      breakIndex = i;
      break;
    }
  }

  return {
    bounced: breakIndex !== -1,
    touchIndex,
    breakIndex,
  };
}

// ===== CONFLUENCE CHECKS =====

function checkSupertrendAligned(
  overlays: Overlays,
  direction: "long" | "short"
): boolean {
  const st = overlays.supertrend;
  if (st.length === 0) return false;

  const latest = st[st.length - 1];
  return direction === "long"
    ? latest.direction === "up"
    : latest.direction === "down";
}

function checkRSIAligned(
  overlays: Overlays,
  direction: "long" | "short"
): boolean {
  const rsi = overlays.rsi;
  if (rsi.length === 0) return false;

  const latest = rsi[rsi.length - 1].value;

  if (direction === "long") return latest < 55;
  else return latest > 45;
}

function checkSMAAligned(
  overlays: Overlays,
  direction: "long" | "short"
): boolean {
  const sma9 = overlays.sma9;
  const sma21 = overlays.sma21;
  if (sma9.length === 0 || sma21.length === 0) return false;

  const v9 = sma9[sma9.length - 1].value;
  const v21 = sma21[sma21.length - 1].value;

  if (direction === "long") return v9 > v21;
  return v9 < v21;
}

function checkVWAPAligned(
  overlays: Overlays,
  currentPrice: number,
  direction: "long" | "short"
): boolean {
  const vwap = overlays.vwap;
  if (vwap.length === 0) return false;

  const v = vwap[vwap.length - 1].value;

  if (direction === "long") return currentPrice > v;
  return currentPrice < v;
}

function checkOrderBlockNear(
  overlays: Overlays,
  currentPrice: number,
  direction: "long" | "short",
  thresholdPct: number = 0.3
): boolean {
  const obs = overlays.orderBlocks;
  if (obs.length === 0) return false;

  const targetType = direction === "long" ? "bullish" : "bearish";

  for (const ob of obs) {
    if (ob.type !== targetType) continue;

    const dist = currentPrice < ob.bottom
      ? ob.bottom - currentPrice
      : currentPrice > ob.top
        ? currentPrice - ob.top
        : 0;

    const distPct = (dist / currentPrice) * 100;
    if (distPct <= thresholdPct) return true;
  }

  return false;
}

function checkFVGNear(
  overlays: Overlays,
  currentPrice: number,
  direction: "long" | "short",
  thresholdPct: number = 0.3
): boolean {
  const fvgs = overlays.fvgs;
  if (fvgs.length === 0) return false;

  const targetType = direction === "long" ? "bullish" : "bearish";

  for (const fvg of fvgs) {
    if (fvg.type !== targetType) continue;

    const dist = currentPrice < fvg.bottom
      ? fvg.bottom - currentPrice
      : currentPrice > fvg.top
        ? currentPrice - fvg.top
        : 0;

    const distPct = (dist / currentPrice) * 100;
    if (distPct <= thresholdPct) return true;
  }

  return false;
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

  // ===== ZONE DETECTION =====
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
      pair,
      timeframe,
      timestamp,
      direction: "neutral",
      orderType: "none",
      signalLabel: "NEUTRAL",
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      takeProfit3: null,
      riskPips: 0,
      rewardPips: [0, 0, 0],
      riskReward: ["0", "0", "0"],
      zone: null,
      entryCandle: null,
      confluences: baseConfluences,
      confidence: "NEUTRAL",
      score: 0,
      neutralReason: "No supply/demand zones detected",
      notes,
    };
  }

  const sortedZones = [...zones].sort(
    (a, b) => a.distanceToPrice - b.distanceToPrice
  );

  const avgRange =
    candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / 20;
  const minBufferPrice = minBufferPips(pair) * pipSize;
  const buffer = Math.max(avgRange * 0.1, minBufferPrice);

  // ===== SCAN ZONES FOR BOUNCE SETUPS =====
  // STOP orders must have a valid entry level relative to current price:
  //   SELL STOP: entryLevel < currentPrice
  //   BUY STOP:  entryLevel > currentPrice
  // If the level is on the wrong side, the setup has been missed — skip.

  for (const zone of sortedZones) {
    if (zone.type === "demand") {
      const bounce = detectDemandBounce(candles, zone);

      if (bounce.bounced) {
        const distanceAbove = currentPrice - zone.top;
        const pctAbove = (distanceAbove / zone.top) * 100;

        const stillAbove = currentPrice > zone.top;
        const notTooFar = pctAbove <= 0.5;

        // BUY STOP entry must be above current price
        const entryLevel = zone.top + buffer;
        const canPlaceStop = entryLevel > currentPrice;

        if (stillAbove && notTooFar && canPlaceStop) {
          const entry = entryLevel;
          const stopLoss = zone.bottom - buffer;
          const risk = Math.abs(entry - stopLoss);

          const tp1 = entry + risk * 2.0;
          const tp2 = entry + risk * 3.5;
          const tp3 = entry + risk * 6.0;

          const riskPips = Math.round(risk / pipSize);
          const rewardPips: [number, number, number] = [
            Math.round(Math.abs(tp1 - entry) / pipSize),
            Math.round(Math.abs(tp2 - entry) / pipSize),
            Math.round(Math.abs(tp3 - entry) / pipSize),
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

          const confidence: Confidence =
            score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 35 ? "LOW" : "NEUTRAL";

          notes.push(`Zone: demand ${zone.bottom.toFixed(5)} - ${zone.top.toFixed(5)}`);
          notes.push(`Demand bounce confirmed — price currently above zone top`);
          notes.push(`Entry (BUY STOP): ${entry.toFixed(5)}`);
          notes.push(`SL: ${stopLoss.toFixed(5)} (risk ${riskPips} pips)`);
          notes.push(`Price currently ${pctAbove.toFixed(2)}% above zone top`);
          if (confluences.supertrendAligned) notes.push("Supertrend aligned ✅");
          if (confluences.rsiAligned) notes.push("RSI aligned ✅");
          if (confluences.smaAligned) notes.push("SMA aligned ✅");
          if (confluences.vwapAligned) notes.push("VWAP aligned ✅");
          notes.push(`Session: ${sessionInfo.name}`);

          return {
            pair,
            timeframe,
            timestamp,
            direction: "long",
            orderType: "stop",
            signalLabel: "BUY STOP",
            entry,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2,
            takeProfit3: tp3,
            riskPips,
            rewardPips,
            riskReward,
            zone: {
              type: zone.type,
              top: zone.top,
              bottom: zone.bottom,
              strength: 0,
              distanceToPrice: zone.distanceToPrice,
            },
            entryCandle: {
              type: "large_range",
              direction: "bullish",
              probability: 70,
              reason: "Demand bounce — price closed above zone with bullish candle",
            },
            confluences,
            confidence,
            score,
            notes,
          };
        }
      }
    } else {
      // Supply zone
      const bounce = detectSupplyBounce(candles, zone);

      if (bounce.bounced) {
        const distanceBelow = zone.bottom - currentPrice;
        const pctBelow = (distanceBelow / zone.bottom) * 100;

        const stillBelow = currentPrice < zone.bottom;
        const notTooFar = pctBelow <= 0.5;

        // SELL STOP entry must be below current price
        const entryLevel = zone.bottom - buffer;
        const canPlaceStop = entryLevel < currentPrice;

        if (stillBelow && notTooFar && canPlaceStop) {
          const entry = entryLevel;
          const stopLoss = zone.top + buffer;
          const risk = Math.abs(entry - stopLoss);

          const tp1 = entry - risk * 2.0;
          const tp2 = entry - risk * 3.5;
          const tp3 = entry - risk * 6.0;

          const riskPips = Math.round(risk / pipSize);
          const rewardPips: [number, number, number] = [
            Math.round(Math.abs(tp1 - entry) / pipSize),
            Math.round(Math.abs(tp2 - entry) / pipSize),
            Math.round(Math.abs(tp3 - entry) / pipSize),
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

          const confidence: Confidence =
            score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 35 ? "LOW" : "NEUTRAL";

          notes.push(`Zone: supply ${zone.bottom.toFixed(5)} - ${zone.top.toFixed(5)}`);
          notes.push(`Supply bounce confirmed — price currently below zone bottom`);
          notes.push(`Entry (SELL STOP): ${entry.toFixed(5)}`);
          notes.push(`SL: ${stopLoss.toFixed(5)} (risk ${riskPips} pips)`);
          notes.push(`Price currently ${pctBelow.toFixed(2)}% below zone bottom`);
          if (confluences.supertrendAligned) notes.push("Supertrend aligned ✅");
          if (confluences.rsiAligned) notes.push("RSI aligned ✅");
          if (confluences.smaAligned) notes.push("SMA aligned ✅");
          if (confluences.vwapAligned) notes.push("VWAP aligned ✅");
          notes.push(`Session: ${sessionInfo.name}`);

          return {
            pair,
            timeframe,
            timestamp,
            direction: "short",
            orderType: "stop",
            signalLabel: "SELL STOP",
            entry,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2,
            takeProfit3: tp3,
            riskPips,
            rewardPips,
            riskReward,
            zone: {
              type: zone.type,
              top: zone.top,
              bottom: zone.bottom,
              strength: 0,
              distanceToPrice: zone.distanceToPrice,
            },
            entryCandle: {
              type: "large_range",
              direction: "bearish",
              probability: 70,
              reason: "Supply bounce — price closed below zone with bearish candle",
            },
            confluences,
            confidence,
            score,
            notes,
          };
        }
      }
    }
  }

  // ===== NO VALID BOUNCE — fall through to LIMIT / MARKET / NEUTRAL =====

  const activeZone = sortedZones.find((z) => {
    if (z.type === "demand" && currentPrice < z.bottom) return false;
    if (z.type === "supply" && currentPrice > z.top) return false;
    const distPct = (z.distanceToPrice / currentPrice) * 100;
    return distPct <= 0.5;
  });

  if (!activeZone) {
    const nearest = sortedZones[0];
    return {
      pair,
      timeframe,
      timestamp,
      direction: "neutral",
      orderType: "none",
      signalLabel: "NEUTRAL",
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      takeProfit3: null,
      riskPips: 0,
      rewardPips: [0, 0, 0],
      riskReward: ["0", "0", "0"],
      zone: {
        type: nearest.type,
        top: nearest.top,
        bottom: nearest.bottom,
        strength: 0,
        distanceToPrice: nearest.distanceToPrice,
      },
      entryCandle: null,
      confluences: baseConfluences,
      confidence: "NEUTRAL",
      score: 0,
      neutralReason: `Price not at zone. Nearest ${nearest.type} at ${nearest.bottom.toFixed(5)} - ${nearest.top.toFixed(5)}`,
      notes,
    };
  }

  const direction: "long" | "short" =
    activeZone.type === "demand" ? "long" : "short";

  const priceInsideZone =
    currentPrice >= activeZone.bottom && currentPrice <= activeZone.top;

  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(zoneCandles, signalDirection);

  let orderType: OrderType;
  let signalLabel: SignalLabel;

  if (priceInsideZone && entryCandle.type !== "none") {
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
  } else if (!priceInsideZone && entryCandle.type === "none") {
    orderType = "limit";
    signalLabel = direction === "long" ? "BUY LIMIT" : "SELL LIMIT";
  } else if (priceInsideZone && entryCandle.type === "none") {
    return {
      pair,
      timeframe,
      timestamp,
      direction,
      orderType: "none",
      signalLabel: "NEUTRAL",
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      takeProfit3: null,
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
        direction: signalDirection,
        probability: 0,
        reason: "No confirmation candle at zone",
      },
      confluences: baseConfluences,
      confidence: "NEUTRAL",
      score: 0,
      neutralReason:
        "Price at zone but no entry signal — waiting for large range candle, engulfing, or pin bar",
      notes,
    };
  } else {
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
  }

  // ===== ENTRY =====
  let entry: number;
  if (orderType === "limit") {
    entry = direction === "long" ? activeZone.top : activeZone.bottom;
  } else {
    entry = currentPrice;
  }

  // ===== SL (guaranteed on correct side of entry) =====
  let stopLoss: number;
  if (direction === "long") {
    const slFromZone = activeZone.bottom - buffer;
    stopLoss = Math.min(slFromZone, entry - buffer);
  } else {
    const slFromZone = activeZone.top + buffer;
    stopLoss = Math.max(slFromZone, entry + buffer);
  }

  // ===== TPs =====
  const risk = Math.abs(entry - stopLoss);
  let tp1: number, tp2: number, tp3: number;

  if (direction === "long") {
    tp1 = entry + risk * 2.0;
    tp2 = entry + risk * 3.5;
    tp3 = entry + risk * 6.0;
  } else {
    tp1 = entry - risk * 2.0;
    tp2 = entry - risk * 3.5;
    tp3 = entry - risk * 6.0;
  }

  const riskPips = Math.round(risk / pipSize);
  const rewardPips: [number, number, number] = [
    Math.round(Math.abs(tp1 - entry) / pipSize),
    Math.round(Math.abs(tp2 - entry) / pipSize),
    Math.round(Math.abs(tp3 - entry) / pipSize),
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

  let score = entryCandle.probability;
  if (confluences.supertrendAligned) score += 5;
  if (confluences.rsiAligned) score += 5;
  if (confluences.smaAligned) score += 5;
  if (confluences.vwapAligned) score += 5;
  if (confluences.orderBlockNear) score += 5;
  if (confluences.fvgNear) score += 5;
  if (confluences.roundNumber) score += 5;
  if (confluences.sessionFavorable) score += 10;
  score = Math.min(score, 100);

  const confidence: Confidence =
    score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : score >= 35 ? "LOW" : "NEUTRAL";

  notes.push(`Zone: ${activeZone.type} ${activeZone.bottom.toFixed(5)} - ${activeZone.top.toFixed(5)}`);
  notes.push(`Entry (${orderType}): ${entry.toFixed(5)}`);
  notes.push(`SL: ${stopLoss.toFixed(5)} (risk ${riskPips} pips)`);
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
    pair,
    timeframe,
    timestamp,
    direction,
    orderType,
    signalLabel,
    entry,
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    riskPips,
    rewardPips,
    riskReward,
    zone: {
      type: activeZone.type,
      top: activeZone.top,
      bottom: activeZone.bottom,
      strength: 0,
      distanceToPrice: activeZone.distanceToPrice,
    },
    entryCandle: {
      type:
        entryCandle.type === "large_range_candle"
          ? "large_range"
          : entryCandle.type,
      direction: entryCandle.direction,
      probability: entryCandle.probability,
      reason: entryCandle.reason,
    },
    confluences,
    confidence,
    score,
    notes,
  };
}