// src/lib/overlays.ts
// Single source of truth for everything drawn on the chart.
// The chart displays these — the AI reads the same object.
// No duplication, no drift.

import {
  detectZones,
  type ZoneCandle,
  type SupplyDemandZone,
} from "@/lib/zone-strategy";
import {
  detectLiquidity,
  detectOrderBlocks,
  detectFVGs,
  detectSupplyDemand,
  sma,
  type SMCCandle,
  type SMCLiquidity,
  type SMCOrderBlock,
  type SMCFVG,
  type SMCSupplyDemand,
} from "@/lib/smc-analysis";
import type { Candle } from "@/lib/data/candles";

// ===== TYPES =====

export interface IndicatorLine {
  time: number;
  value: number;
}

export interface SuperTrendPoint {
  time: number;
  value: number;
  direction: "up" | "down";
}

export interface RoundNumber {
  level: number;
  type: "major" | "minor" | "half" | "quarter";
}

export interface PivotLevels {
  pp: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface SessionBox {
  name: "asian" | "london" | "ny";
  startTime: number;
  endTime: number;
  high: number;
  low: number;
}

export interface LargeRangeMarker {
  time: number;
  price: number;
  direction: "bullish" | "bearish";
  rangePct: number;
}

export interface Overlays {
  sdZones: SupplyDemandZone[];
  orderBlocks: SMCOrderBlock[];
  fvgs: SMCFVG[];
  liquidityZones: SMCLiquidity[];
  smcSupplyDemand: SMCSupplyDemand[];

  sma9: IndicatorLine[];
  sma21: IndicatorLine[];
  sma200: IndicatorLine[];
  ema50: IndicatorLine[];
  vwap: IndicatorLine[];

  supertrend: SuperTrendPoint[];
  rsi: IndicatorLine[];

  roundNumbers: RoundNumber[];
  pivots: PivotLevels | null;

  sessions: SessionBox[];
  largeRangeCandles: LargeRangeMarker[];
}

// ===== INDICATOR MATH =====

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(values[0]);
    } else if (i < period) {
      out.push(values[i]);
    } else {
      out.push(values[i] * k + out[i - 1] * (1 - k));
    }
  }

  return out;
}

function calcRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);

  if (closes.length < period + 1) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

function calcSupertrend(
  candles: Candle[],
  period: number = 10,
  multiplier: number = 3
): SuperTrendPoint[] {
  if (candles.length < period) return [];

  const trueRanges: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges.push(candles[i].high - candles[i].low);
    } else {
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      );
      trueRanges.push(tr);
    }
  }

  const atr: number[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period) {
      atr.push(
        trueRanges.slice(0, i + 1).reduce((s, v) => s + v, 0) / (i + 1)
      );
    } else {
      atr.push((atr[i - 1] * (period - 1) + trueRanges[i]) / period);
    }
  }

  const result: SuperTrendPoint[] = [];
  let trend: "up" | "down" = "up";
  let prevUpper = 0;
  let prevLower = 0;

  for (let i = 0; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const upperBand = hl2 + multiplier * atr[i];
    const lowerBand = hl2 - multiplier * atr[i];

    let finalUpper = upperBand;
    let finalLower = lowerBand;

    if (i > 0) {
      finalUpper =
        upperBand < prevUpper || candles[i - 1].close > prevUpper
          ? upperBand
          : prevUpper;
      finalLower =
        lowerBand > prevLower || candles[i - 1].close < prevLower
          ? lowerBand
          : prevLower;
    }

    if (i === 0) {
      trend = candles[i].close > lowerBand ? "up" : "down";
    } else {
      if (trend === "up" && candles[i].close < finalLower) trend = "down";
      else if (trend === "down" && candles[i].close > finalUpper) trend = "up";
    }

    result.push({
      time: candles[i].time,
      value: trend === "up" ? finalLower : finalUpper,
      direction: trend,
    });

    prevUpper = finalUpper;
    prevLower = finalLower;
  }

  return result;
}

function calcVWAP(candles: Candle[]): IndicatorLine[] {
  const out: IndicatorLine[] = [];
  let cumPV = 0;
  let cumVol = 0;
  let lastDay = -1;

  for (const c of candles) {
    const day = Math.floor(c.time / 86400);

    if (day !== lastDay) {
      cumPV = 0;
      cumVol = 0;
      lastDay = day;
    }

    const typical = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;
    cumPV += typical * vol;
    cumVol += vol;

    out.push({
      time: c.time,
      value: cumVol > 0 ? cumPV / cumVol : c.close,
    });
  }

  return out;
}

// ===== ROUND NUMBERS =====

function calcRoundNumbers(pair: string, currentPrice: number): RoundNumber[] {
  const upper = pair.toUpperCase();
  let step: number;

  if (upper.includes("XAU")) step = 50;
  else if (upper.includes("XAG")) step = 1;
  else if (upper.includes("BTC")) step = 5000;
  else if (upper.includes("ETH")) step = 500;
  else if (upper.includes("JPY")) step = 1;
  else step = 0.01;

  const levels: RoundNumber[] = [];
  const base = Math.floor(currentPrice / step) * step;

  for (let i = -5; i <= 5; i++) {
    const level = base + i * step;
    if (level <= 0) continue;

    const distPct = Math.abs(level - currentPrice) / currentPrice;
    let type: RoundNumber["type"] = "minor";

    if (distPct < 0.0005) type = "major";
    else if (distPct < 0.002) type = "half";
    else type = "quarter";

    levels.push({ level: Number(level.toFixed(5)), type });
  }

  return levels;
}

// ===== PIVOTS =====

function calcPivots(candles: Candle[]): PivotLevels | null {
  if (candles.length < 20) return null;

  const now = candles[candles.length - 1].time;
  const twoDaysAgo = now - 86400 * 2;

  const prevDayCandles = candles.filter(
    (c) => c.time >= twoDaysAgo && c.time < now - 86400
  );

  if (prevDayCandles.length === 0) return null;

  const high = Math.max(...prevDayCandles.map((c) => c.high));
  const low = Math.min(...prevDayCandles.map((c) => c.low));
  const close = prevDayCandles[prevDayCandles.length - 1].close;

  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  const r2 = pp + (high - low);
  const s2 = pp - (high - low);
  const r3 = high + 2 * (pp - low);
  const s3 = low - 2 * (high - pp);

  return { pp, r1, r2, r3, s1, s2, s3 };
}

// ===== SESSIONS =====

function calcSessions(candles: Candle[]): SessionBox[] {
  const sessions: SessionBox[] = [];

  const byDay = new Map<number, Candle[]>();
  for (const c of candles) {
    const day = Math.floor(c.time / 86400);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c);
  }

  for (const [day, dayCandles] of byDay) {
    const dayStart = day * 86400;

    const windows: { name: SessionBox["name"]; start: number; end: number }[] =
      [
        { name: "asian", start: dayStart + 0 * 3600, end: dayStart + 7 * 3600 },
        {
          name: "london",
          start: dayStart + 7 * 3600,
          end: dayStart + 12 * 3600,
        },
        { name: "ny", start: dayStart + 12 * 3600, end: dayStart + 21 * 3600 },
      ];

    for (const w of windows) {
      const inWindow = dayCandles.filter(
        (c) => c.time >= w.start && c.time < w.end
      );
      if (inWindow.length === 0) continue;

      sessions.push({
        name: w.name,
        startTime: inWindow[0].time,
        endTime: inWindow[inWindow.length - 1].time,
        high: Math.max(...inWindow.map((c) => c.high)),
        low: Math.min(...inWindow.map((c) => c.low)),
      });
    }
  }

  return sessions;
}

// ===== LARGE RANGE CANDLES =====

function calcLargeRangeCandles(candles: Candle[]): LargeRangeMarker[] {
  const markers: LargeRangeMarker[] = [];
  if (candles.length < 20) return markers;

  const avgRange =
    candles.slice(-20).reduce((s, c) => s + (c.high - c.low), 0) / 20;

  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    const rangePct = (range / c.close) * 100;

    if (rangePct >= 0.12 && range > avgRange * 1.5) {
      markers.push({
        time: c.time,
        price: c.is_green ? c.low : c.high,
        direction: c.is_green ? "bullish" : "bearish",
        rangePct,
      });
    }
  }

  return markers;
}

// ===== MAIN FUNCTION =====

export function computeOverlays(pair: string, candles: Candle[]): Overlays {
  if (candles.length === 0) {
    return {
      sdZones: [],
      orderBlocks: [],
      fvgs: [],
      liquidityZones: [],
      smcSupplyDemand: [],
      sma9: [],
      sma21: [],
      sma200: [],
      ema50: [],
      vwap: [],
      supertrend: [],
      rsi: [],
      roundNumbers: [],
      pivots: null,
      sessions: [],
      largeRangeCandles: [],
    };
  }

  const zoneCandles: ZoneCandle[] = candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    is_green: c.is_green,
  }));

  const smcCandles: SMCCandle[] = zoneCandles;

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  // ===== ZONES =====
  const sdZones = detectZones(zoneCandles);
  const orderBlocks = detectOrderBlocks(smcCandles);
  const fvgs = detectFVGs(smcCandles);
  const liquidityZones = detectLiquidity(smcCandles);
  const smcSupplyDemand = detectSupplyDemand(smcCandles);

  // ===== SMA LINES =====
  const sma9Arr: IndicatorLine[] = [];
  const sma21Arr: IndicatorLine[] = [];
  const sma200Arr: IndicatorLine[] = [];

  for (let i = 0; i < candles.length; i++) {
    const slice = smcCandles.slice(0, i + 1);
    if (slice.length >= 9) {
      sma9Arr.push({ time: candles[i].time, value: sma(slice, 9) });
    }
    if (slice.length >= 21) {
      sma21Arr.push({ time: candles[i].time, value: sma(slice, 21) });
    }
    if (slice.length >= 200) {
      sma200Arr.push({ time: candles[i].time, value: sma(slice, 200) });
    }
  }

  // ===== EMA 50 =====
  const ema50Values = calcEMA(closes, 50);
  const ema50: IndicatorLine[] = candles.map((c, i) => ({
    time: c.time,
    value: ema50Values[i],
  }));

  // ===== VWAP =====
  const vwap = calcVWAP(candles);

  // ===== SUPERTREND =====
  const supertrend = calcSupertrend(candles, 10, 3);

  // ===== RSI =====
  const rsiValues = calcRSI(closes, 14);
  const rsi: IndicatorLine[] = candles.map((c, i) => ({
    time: c.time,
    value: rsiValues[i],
  }));

  // ===== LEVELS =====
  const roundNumbers = calcRoundNumbers(pair, currentPrice);
  const pivots = calcPivots(candles);

  // ===== SESSIONS =====
  const sessions = calcSessions(candles);

  // ===== LARGE RANGE MARKERS =====
  const largeRangeCandles = calcLargeRangeCandles(candles);

  return {
    sdZones,
    orderBlocks,
    fvgs,
    liquidityZones,
    smcSupplyDemand,
    sma9: sma9Arr,
    sma21: sma21Arr,
    sma200: sma200Arr,
    ema50,
    vwap,
    supertrend,
    rsi,
    roundNumbers,
    pivots,
    sessions,
    largeRangeCandles,
  };
}