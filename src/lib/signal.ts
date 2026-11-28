// src/lib/signal.ts
// Signal orchestrator — ATR-based SL, risk-multiple TPs, limit/market orders only.
//
// Confirmed entries can be market orders. A fresh valid zone can also stage a
// low-confidence limit while waiting for a closed-bar confirmation.

import type { Candle } from "@/lib/data/candles";
import type { Overlays, VolumeProfile } from "@/lib/overlays";
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
export type ActionableConfidence = Exclude<Confidence, "NEUTRAL">;

export interface SignalZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  strength: number;
  distanceToPrice: number;
  formedAt: number;
  source: "base-departure" | "order-block" | "fvg" | "market-structure";
  invalidation: "close-beyond-zone";
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
  structureAligned: boolean;
  premiumDiscountAligned: boolean;
  liquiditySweepAligned: boolean;
  volumeProfileAligned: boolean;
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
  volumeProfile: VolumeProfile | null;
  confidence: Confidence;
  score: number;
  setupId: string;
  notes: string[];
  candidateType?: "base-departure" | "order-block" | "fvg" | "market-structure";
  priceVerification?: {
    chartPrice: number;
    comparisonPrice: number | null;
    yahooPrice: number | null;
    dukascopyPrice: number | null;
    swissquotePrice: number | null;
    primarySource: string;
    comparisonSource: string | null;
    comparisonTime: number | null;
    diffPct: number;
    tolerance: number;
    verified: boolean;
  };
}

// ===== HELPERS =====

interface TradeableZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  index: number;
  formedAt: number;
  distanceToPrice: number;
  source: SignalZone["source"];
}

function toTradeableZones(
  candles: Candle[],
  baseZones: SupplyDemandZone[],
  orderBlocks: Overlays["orderBlocks"],
  fvgs: Overlays["fvgs"],
  maxDistance: number,
  currentPrice: number
): TradeableZone[] {
  const zones: TradeableZone[] = baseZones.map((zone) => ({
    type: zone.type,
    top: zone.top,
    bottom: zone.bottom,
    index: zone.index,
    formedAt: zone.formedAt,
    distanceToPrice:
      currentPrice > zone.top
        ? currentPrice - zone.top
        : currentPrice < zone.bottom
          ? zone.bottom - currentPrice
          : 0,
    source: "base-departure",
  }));

  for (const block of orderBlocks) {
    const type = block.type === "bullish" ? "demand" : "supply";
    if (candles.slice(block.index + 1).some((candle) =>
      type === "demand" ? candle.close < block.bottom : candle.close > block.top
    )) {
      continue;
    }
    if (block.index > candles.length - 5) continue;

    const top = Math.max(block.top, block.bottom);
    const bottom = Math.min(block.top, block.bottom);
    const distanceToPrice =
      currentPrice > top
        ? currentPrice - top
        : currentPrice < bottom
          ? bottom - currentPrice
          : 0;
    zones.push({
      type,
      top,
      bottom,
      index: block.index,
      formedAt: candles[block.index]?.time ?? block.index,
      distanceToPrice,
      source: "order-block",
    });
  }

  for (const fvg of fvgs) {
    const type = fvg.type === "bullish" ? "demand" : "supply";
    const fillIndex = fvg.index - 1;
    if (fillIndex < 1) continue;
    if (candles.slice(fillIndex + 1).some((candle) =>
      type === "demand" ? candle.close < fvg.bottom : candle.close > fvg.top
    )) {
      continue;
    }
    if (fillIndex > candles.length - 5) continue;

    const top = Math.max(fvg.top, fvg.bottom);
    const bottom = Math.min(fvg.top, fvg.bottom);
    const distanceToPrice =
      currentPrice > top
        ? currentPrice - top
        : currentPrice < bottom
          ? bottom - currentPrice
          : 0;
    zones.push({
      type,
      top,
      bottom,
      index: fillIndex,
      formedAt: candles[fillIndex]?.time ?? fillIndex,
      distanceToPrice,
      source: "fvg",
    });
  }

  return zones
    .filter((zone) => zone.distanceToPrice <= maxDistance)
    .sort((a, b) => a.distanceToPrice - b.distanceToPrice);
}

function buildStructureZone(
  candles: Candle[],
  overlays: Overlays,
  direction: "long" | "short",
  atr: number,
  pipSize: number,
  currentPrice: number
): TradeableZone | null {
  if (candles.length === 0) return null;

  const levels: { price: number; index: number }[] = [];

  for (const liquidity of overlays.liquidityZones) {
    const correctSide =
      direction === "long"
        ? liquidity.type === "sell_side" && liquidity.price < currentPrice
        : liquidity.type === "buy_side" && liquidity.price > currentPrice;
    if (correctSide) levels.push({ price: liquidity.price, index: liquidity.index });
  }

  const swing =
    direction === "long" ? overlays.structure.lastSwingLow : overlays.structure.lastSwingHigh;
  if (swing && (direction === "long" ? swing.price < currentPrice : swing.price > currentPrice)) {
    levels.push({ price: swing.price, index: swing.index });
  }

  const start = Math.max(2, candles.length - 80);
  for (let index = start; index < candles.length - 2; index++) {
    const candle = candles[index];
    if (direction === "long") {
      const isSwingLow =
        candle.low <= candles[index - 1].low &&
        candle.low <= candles[index + 1].low &&
        candle.low < candles[index - 2].low &&
        candle.low < candles[index + 2].low;
      if (isSwingLow && candle.low < currentPrice) {
        levels.push({ price: candle.low, index });
      }
    } else {
      const isSwingHigh =
        candle.high >= candles[index - 1].high &&
        candle.high >= candles[index + 1].high &&
        candle.high > candles[index - 2].high &&
        candle.high > candles[index + 2].high;
      if (isSwingHigh && candle.high > currentPrice) {
        levels.push({ price: candle.high, index });
      }
    }
  }

  levels.sort(
    (a, b) =>
      Math.abs(currentPrice - a.price) - Math.abs(currentPrice - b.price)
  );

  let level = levels[0]?.price;
  let index = levels[0]?.index ?? candles.length - 2;
  if (level == null) {
    const recent = candles.slice(-30);
    level =
      direction === "long"
        ? Math.min(...recent.map((candle) => candle.low))
        : Math.max(...recent.map((candle) => candle.high));
    if (direction === "long" && level >= currentPrice) {
      level = currentPrice - Math.max(atr * 2, pipSize);
    }
    if (direction === "short" && level <= currentPrice) {
      level = currentPrice + Math.max(atr * 2, pipSize);
    }
  }

  const buffer = Math.max(atr * 0.35, pipSize);
  let bottom = level - buffer;
  let top = level + buffer;
  const gap = Math.max(atr * 0.1, pipSize * 0.5);

  if (direction === "long" && top >= currentPrice) {
    const shift = currentPrice - gap - top;
    bottom += shift;
    top += shift;
  }
  if (direction === "short" && bottom <= currentPrice) {
    const shift = currentPrice + gap - bottom;
    bottom += shift;
    top += shift;
  }

  return {
    type: direction === "long" ? "demand" : "supply",
    top,
    bottom,
    index,
    formedAt: candles[index]?.time ?? candles[candles.length - 1].time,
    distanceToPrice:
      direction === "long" ? Math.max(0, currentPrice - top) : Math.max(0, bottom - currentPrice),
    source: "market-structure",
  };
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
  verifiedPrice?: VerifiedPrice,
  smcBias?: { direction: "long" | "short" | "neutral"; score: number },
  currentPriceOverride?: number
): TradingSignal {
  const pipSize = calcPipSize(pair);
  const currentPrice =
    currentPriceOverride != null &&
    Number.isFinite(currentPriceOverride) &&
    currentPriceOverride > 0
      ? currentPriceOverride
      : candles[candles.length - 1].close;
  const timestamp = candles[candles.length - 1].time;

  const notes: string[] = [];
  const sessionInfo = getSession();
  const round = nearestRoundNumber(pair, currentPrice);
  const roundNumberNear = round !== null && round.distancePct < 0.15;

  const priceVerification = verifiedPrice
    ? {
        chartPrice: verifiedPrice.chartPrice,
        comparisonPrice: verifiedPrice.comparisonPrice,
        yahooPrice: verifiedPrice.yahooPrice,
        dukascopyPrice: verifiedPrice.dukascopyPrice,
        swissquotePrice: verifiedPrice.swissquotePrice,
        primarySource: verifiedPrice.primarySource,
        comparisonSource: verifiedPrice.comparisonSource,
        comparisonTime: verifiedPrice.comparisonTime,
        diffPct: verifiedPrice.diffPct,
        tolerance: verifiedPrice.tolerance,
        verified: verifiedPrice.ok,
      }
    : undefined;

  const zoneCandles: ZoneCandle[] = candles.map((c) => ({
    open: c.open, high: c.high, low: c.low, close: c.close, is_green: c.is_green, time: c.time,
  }));
  const atr = calcATR(candles, 14);

  const neutralConfluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: false, rsiAligned: false, smaAligned: false,
    vwapAligned: false, orderBlockNear: false, fvgNear: false,
    structureAligned: false, premiumDiscountAligned: false, liquiditySweepAligned: false,
    volumeProfileAligned: false,
    session: sessionInfo.name, sessionFavorable: sessionInfo.favorable,
  };

  const makeNeutral = (
    neutralNotes: string[],
    zone: TradeableZone | null = null,
    entryCandle: SignalEntryCandle = {
      type: "none",
      direction: "bullish",
      probability: 0,
      reason: "No valid setup on the chart.",
    },
  ): TradingSignal => ({
    pair,
    timeframe,
    timestamp,
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
    zone: zone
      ? {
          type: zone.type,
          top: zone.top,
          bottom: zone.bottom,
          strength: 0,
          distanceToPrice: zone.distanceToPrice,
          formedAt: zone.formedAt,
          source: zone.source,
          invalidation: "close-beyond-zone",
        }
      : null,
    entryCandle,
    confluences: neutralConfluences,
    volumeProfile: overlays.volumeProfile,
    candidateType: zone?.source,
    confidence: "NEUTRAL",
    score: 0,
    setupId: `neutral:${pair}:${timeframe}:${timestamp}`,
    notes: neutralNotes,
    priceVerification,
  });

  if (verifiedPrice && !verifiedPrice.ok) {
    return makeNeutral([
      verifiedPrice.reason || "Price could not be cross-validated.",
      "Neutral — no trade until market prices agree.",
    ]);
  }

  const averageRange = candles.slice(-20).reduce((sum, candle) => sum + candle.high - candle.low, 0) /
    Math.min(candles.length, 20);
  const maxZoneDistance = Math.max(atr * 6, averageRange * 3, pipSize * 5);
  const zones = toTradeableZones(
    candles,
    detectZones(zoneCandles),
    overlays.orderBlocks,
    overlays.fvgs,
    maxZoneDistance,
    currentPrice
  );

  // ===== ZONE SELECTION =====
  const sortedZones = [...zones].sort((a, b) => a.distanceToPrice - b.distanceToPrice);
  const smcDirection: "long" | "short" | null =
    smcBias && smcBias.direction !== "neutral" ? smcBias.direction : null;
  const preferredDirection =
    smcDirection && smcBias!.score >= 65 ? smcDirection : null;
  const matchesPreferredDirection = (zone: TradeableZone) =>
    preferredDirection == null ||
    (preferredDirection === "long" ? zone.type === "demand" : zone.type === "supply");

  const insideZone = sortedZones.find(
    (z) => matchesPreferredDirection(z) && currentPrice >= z.bottom && currentPrice <= z.top
  );

  const correctSideZone = sortedZones.find((z) => {
    if (!matchesPreferredDirection(z)) return false;
    if (z.type === "demand" && z.top < currentPrice) return true;
    if (z.type === "supply" && z.bottom > currentPrice) return true;
    return false;
  });

  const fallbackDirection: "long" | "short" =
    preferredDirection ??
    smcDirection ??
    (overlays.structure.trend === "bullish" || overlays.structure.trend === "bearish"
      ? overlays.structure.trend === "bullish"
        ? "long"
        : "short"
      : overlays.structure.lastEvent?.direction === "bullish"
        ? "long"
        : overlays.structure.lastEvent?.direction === "bearish"
          ? "short"
          : overlays.premiumDiscount?.zone === "premium"
            ? "short"
            : "long");

  const activeZone =
    insideZone ??
    correctSideZone ??
    buildStructureZone(candles, overlays, fallbackDirection, atr, pipSize, currentPrice);

  if (!activeZone) {
    return makeNeutral(
      ["No tradeable market structure is available on this chart."],
      null
    );
  }

  const slDistance = atr * 2.0;

  const direction: "long" | "short" = activeZone.type === "demand" ? "long" : "short";
  const signalDirection = direction === "long" ? "bullish" : "bearish";
  const entryCandle = detectEntrySignal(
    zoneCandles,
    signalDirection,
    activeZone,
    3
  );
  const hasConfirmation = entryCandle.type !== "none";
  const priceInsideZone = currentPrice >= activeZone.bottom && currentPrice <= activeZone.top;

  // ===== ORDER TYPE =====
  let orderType: OrderType;
  let signalLabel: SignalLabel;
  let entryLevel: number;

  if (priceInsideZone && hasConfirmation) {
    orderType = "market";
    signalLabel = direction === "long" ? "BUY" : "SELL";
    entryLevel = currentPrice;
  } else {
    orderType = "limit";
    signalLabel = direction === "long" ? "BUY LIMIT" : "SELL LIMIT";

    if (priceInsideZone) {
      entryLevel =
        direction === "long"
          ? Math.min(activeZone.bottom, currentPrice - atr * 0.25)
          : Math.max(activeZone.top, currentPrice + atr * 0.25);
    } else if (direction === "long") {
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
  const atrStop =
    direction === "long" ? entryLevel - slDistance : entryLevel + slDistance;
  const swing =
    direction === "long"
      ? overlays.structure.lastSwingLow
      : overlays.structure.lastSwingHigh;
  const lastCandle = candles[candles.length - 1];
  const structuralLevel =
    direction === "long"
      ? Math.min(
          activeZone.bottom,
          swing?.price ?? activeZone.bottom,
          lastCandle.low
        )
      : Math.max(
          activeZone.top,
          swing?.price ?? activeZone.top,
          lastCandle.high
        );
  const structuralStop =
    direction === "long"
      ? structuralLevel - atr * 0.25
      : structuralLevel + atr * 0.25;
  const structuralDistance = Math.abs(entryLevel - structuralStop);
  const rawSL =
    structuralDistance > 0 && structuralDistance <= slDistance * 1.5
      ? direction === "long"
        ? Math.min(structuralStop, entryLevel - atr * 0.75)
        : Math.max(structuralStop, entryLevel + atr * 0.75)
      : atrStop;
  const stopBasis =
    Math.abs(rawSL - atrStop) < 1e-10 ? "2.0 × ATR" : "structure + ATR buffer";

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

  const volumeProfile = overlays.volumeProfile;
  const volumeProfileAligned =
    volumeProfile != null &&
    activeZone.top >= volumeProfile.val &&
    activeZone.bottom <= volumeProfile.vah;

  const confluences: SignalConfluences = {
    roundNumber: roundNumberNear,
    supertrendAligned: checkSupertrendAligned(overlays, direction),
    rsiAligned: checkRSIAligned(overlays, direction),
    smaAligned: checkSMAAligned(overlays, direction),
    vwapAligned: checkVWAPAligned(overlays, currentPrice, direction),
    orderBlockNear: checkOrderBlockNear(overlays, currentPrice, direction),
    fvgNear: checkFVGNear(overlays, currentPrice, direction),
    structureAligned:
      overlays.structure.trend === (direction === "long" ? "bullish" : "bearish"),
    premiumDiscountAligned:
      direction === "long"
        ? overlays.premiumDiscount?.zone === "discount"
        : overlays.premiumDiscount?.zone === "premium",
    liquiditySweepAligned:
      overlays.liquiditySweeps.at(-1)?.reclaimed === true &&
      overlays.liquiditySweeps.at(-1)?.side ===
        (direction === "long" ? "sell_side" : "buy_side"),
    volumeProfileAligned,
    session: sessionInfo.name,
    sessionFavorable: sessionInfo.favorable,
  };

  const smcSupportsDirection =
    smcBias != null &&
    smcBias.direction !== "neutral" &&
    smcBias.direction === direction &&
    smcBias.score >= 55;
  const structureSupportsDirection = confluences.structureAligned;

  let score = entryCandle.probability;
  if (confluences.supertrendAligned) score += 5;
  if (confluences.rsiAligned) score += 5;
  if (confluences.smaAligned) score += 5;
  if (confluences.vwapAligned) score += 5;
  if (confluences.orderBlockNear) score += 5;
  if (confluences.fvgNear) score += 5;
  if (confluences.structureAligned) score += 5;
  if (confluences.premiumDiscountAligned) score += 5;
  if (confluences.liquiditySweepAligned) score += 5;
  if (confluences.volumeProfileAligned) score += 5;
  if (confluences.roundNumber) score += 5;
  if (confluences.sessionFavorable) score += 10;
  if (!hasConfirmation) {
    if (smcSupportsDirection) score = Math.max(score, smcBias!.score);
    if (structureSupportsDirection) score = Math.max(score, 60);
    score = Math.min(49, Math.max(30, score));
  }

  score = Math.min(100, score);

  const confidence: ActionableConfidence =
    score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : "LOW";
  const setupId = [
    "ai",
    pair,
    timeframe,
    direction,
    activeZone.type,
    activeZone.formedAt,
    activeZone.bottom.toFixed(8),
    activeZone.top.toFixed(8),
  ].join(":");

  notes.push(
    `Zone (${activeZone.source}): ${activeZone.type} ${activeZone.bottom.toFixed(5)} - ${activeZone.top.toFixed(5)}`
  );
  notes.push(`Current price: ${currentPrice.toFixed(5)}`);
  notes.push(`ATR(14): ${atr.toFixed(5)} | SL basis: ${stopBasis}`);
  notes.push(`Entry (${signalLabel}): ${entryLevel.toFixed(5)}`);
  notes.push(`SL: ${rawSL.toFixed(5)} — risk ${riskPips} pips`);
  notes.push(`TPs: 1.0× / 1.5× / 3.0× risk (R:R 1:1 / 1:1.5 / 1:3)`);
  notes.push(`Session: ${sessionInfo.name}`);
  if (volumeProfile) {
    notes.push(
      `Volume profile (${volumeProfile.source}): POC ${volumeProfile.poc.toFixed(5)} | VAH ${volumeProfile.vah.toFixed(5)} | VAL ${volumeProfile.val.toFixed(5)}`
    );
  }
  if (!hasConfirmation) {
    notes.push("No closed-bar confirmation yet — low-confidence limit staged at the zone; cancel if the zone invalidates.");
  }
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
      formedAt: activeZone.formedAt,
      source: activeZone.source,
      invalidation: "close-beyond-zone",
    },
    entryCandle: {
      type: entryCandle.type === "large_range_candle" ? "large_range" : entryCandle.type,
      direction: entryCandle.direction,
      probability: entryCandle.probability,
      reason: entryCandle.reason,
    },
    confluences, volumeProfile, confidence, score, setupId, notes,
    priceVerification,
  };
}
