// src/lib/zone-strategy.ts
// PURE Supply/Demand Zone Strategy — follows only the 8-part cheat sheet series.
// No SMA, no liquidity, no order blocks, no FVG, no indicators.
// Strategy: Wait for price at zone → confirm with Large Range Candle / Engulfing / Pin Bar
//          → SL beyond zone edge → TPs at Fibonacci extensions.

export interface ZoneCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  is_green: boolean;
}

export interface SupplyDemandZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  index: number;
  formedAt: number;
  swingHigh: number;
  swingLow: number;
  distanceToPrice: number;
  atZone: boolean;
}

export interface EntrySignal {
  type: "large_range_candle" | "engulfing" | "pin_bar" | "none";
  direction: "bullish" | "bearish";
  probability: number;
  candleRange: number;
  reason: string;
}

export interface FibonacciLevels {
  swingStart: number;
  swingEnd: number;
  swingRange: number;
  ext_1_272: number;
  ext_1_618: number;
  ext_2_0: number;
  ret_0_236: number;
}

export interface PositionSizing {
  accountSize: number;
  riskPercent: number;
  riskDollars: number;
  stopDistancePips: number;
  pipValuePerLot: number;
  lots: number;
}

export interface ZoneSignal {
  status: "signal" | "watching" | "no_setup";
  message: string;

  direction?: "long" | "short";
  zone?: SupplyDemandZone;
  entrySignal?: EntrySignal;

  entry?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskPips?: number;
  rewardPips1?: number;
  rewardPips2?: number;
  rewardPips3?: number;
  riskReward1?: string;
  riskReward2?: string;
  riskReward3?: string;

  fibonacci?: FibonacciLevels;

  tradeManagement?: string[];

  positionSizing?: PositionSizing;

  mtfConfirmed?: boolean;
  mtfNote?: string;

  session?: string;
  sessionWeight?: string;

  nearRoundNumber?: boolean;
  roundNumberNote?: string;

  confidence?: "HIGH" | "MEDIUM" | "LOW";
  confluences?: string[];
  candleCount: number;
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

function pipValuePerLot(pair: string): number {
  if (pair.includes("XAU")) return 10;
  if (pair.includes("XAG")) return 50;
  if (pair.includes("BTC")) return 1;
  if (pair.includes("ETH")) return 1;
  const [, quote] = pair.split("/");
  if (quote === "JPY") return 9.5;
  return 10;
}

function avgRange(candles: ZoneCandle[], lookback: number = 20): number {
  const sample = candles.slice(-lookback);
  const total = sample.reduce((s, c) => s + (c.high - c.low), 0);
  return total / sample.length;
}

function getSession(): { name: string; weight: string } {
  const hour = new Date().getUTCHours();
  if (hour >= 7 && hour <= 11) return { name: "LONDON", weight: "High liquidity — strong setups" };
  if (hour >= 12 && hour <= 16) return { name: "LONDON-NY OVERLAP", weight: "Highest liquidity — best setups" };
  if (hour >= 17 && hour <= 21) return { name: "NEW YORK", weight: "High liquidity — strong setups" };
  if (hour >= 0 && hour <= 6) return { name: "ASIAN", weight: "Lower volatility — weaker setups" };
  return { name: "OFF-HOURS", weight: "Reduced liquidity" };
}

function nearestRoundNumber(price: number, pair: string): { level: number; distance: number; distancePct: number } | null {
  let step: number;

  if (pair.includes("XAU")) step = price > 2000 ? 50 : 25;
  else if (pair.includes("XAG")) step = 1;
  else if (pair.includes("BTC")) step = 5000;
  else if (pair.includes("ETH")) step = 500;
  else if (pair.includes("JPY")) step = 1;
  else step = 0.01;

  const nearest = Math.round(price / step) * step;
  const distance = Math.abs(price - nearest);
  const distancePct = (distance / price) * 100;

  return { level: nearest, distance, distancePct };
}

// ===== STEP 1: DETECT SUPPLY & DEMAND ZONES =====

export function detectZones(candles: ZoneCandle[]): SupplyDemandZone[] {
  if (candles.length < 10) return [];

  const zones: SupplyDemandZone[] = [];
  const avg = avgRange(candles);
  const currentPrice = candles[candles.length - 1].close;

  for (let i = 1; i < candles.length - 2; i++) {
    const base = candles[i];
    const baseBody = Math.abs(base.close - base.open);
    const next = candles[i + 1];
    const nextBody = Math.abs(next.close - next.open);

    if (baseBody > avg * 0.5) continue;
    if (nextBody < avg * 1.5) continue;

    const zoneTop = base.high;
    const zoneBottom = base.low;

    // Demand zone: bullish explosive move
    if (next.close > next.open && next.close > zoneTop) {
      let swingHigh = next.high;
      for (let j = i + 1; j < Math.min(i + 20, candles.length); j++) {
        swingHigh = Math.max(swingHigh, candles[j].high);
      }

      const atZone = currentPrice >= zoneBottom * 0.999 && currentPrice <= zoneTop * 1.001;
      const distanceToPrice = currentPrice > zoneTop ? currentPrice - zoneTop : 0;

      zones.push({
        type: "demand",
        top: zoneTop,
        bottom: zoneBottom,
        index: i,
        formedAt: zoneBottom,
        swingHigh,
        swingLow: zoneBottom,
        distanceToPrice,
        atZone,
      });
    }

    // Supply zone: bearish explosive move
    if (next.close < next.open && next.close < zoneBottom) {
      let swingLow = next.low;
      for (let j = i + 1; j < Math.min(i + 20, candles.length); j++) {
        swingLow = Math.min(swingLow, candles[j].low);
      }

      const atZone = currentPrice >= zoneBottom * 0.999 && currentPrice <= zoneTop * 1.001;
      const distanceToPrice = currentPrice < zoneBottom ? zoneBottom - currentPrice : 0;

      zones.push({
        type: "supply",
        top: zoneTop,
        bottom: zoneBottom,
        index: i,
        formedAt: zoneTop,
        swingHigh: zoneTop,
        swingLow,
        distanceToPrice,
        atZone,
      });
    }
  }

  // Keep only relevant zones
  const relevantZones = zones.filter((z) => {
    if (z.index > candles.length - 5) return false;

    if (z.type === "demand") {
      return z.bottom > currentPrice - avg * 3;
    }

    if (z.type === "supply") {
      return z.top < currentPrice + avg * 3;
    }

    return true;
  });

  relevantZones.sort((a, b) => a.distanceToPrice - b.distanceToPrice);

  return relevantZones.slice(0, 5);
}

// ===== STEP 2: DETECT ENTRY SIGNALS =====

function detectLargeRangeCandle(
  candles: ZoneCandle[],
  direction: "bullish" | "bearish",
): EntrySignal | null {
  if (candles.length < 3) return null;

  const last = candles[candles.length - 1];

  const range = last.high - last.low;
  const rangePct = (range / last.close) * 100;

  if (rangePct < 0.12) return null;

  const closePosition = (last.close - last.low) / range;

  if (direction === "bullish") {
    if (last.is_green && closePosition >= 0.75) {
      return {
        type: "large_range_candle",
        direction: "bullish",
        probability: 70,
        candleRange: rangePct,
        reason: `Large bullish candle (${rangePct.toFixed(3)}% range, closed in top ${((1 - closePosition) * 100).toFixed(0)}%)`,
      };
    }
  } else {
    if (!last.is_green && closePosition <= 0.25) {
      return {
        type: "large_range_candle",
        direction: "bearish",
        probability: 70,
        candleRange: rangePct,
        reason: `Large bearish candle (${rangePct.toFixed(3)}% range, closed in bottom ${(closePosition * 100).toFixed(0)}%)`,
      };
    }
  }

  return null;
}

function detectEngulfing(
  candles: ZoneCandle[],
  direction: "bullish" | "bearish",
): EntrySignal | null {
  if (candles.length < 2) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  if (direction === "bullish") {
    if (
      last.is_green &&
      !prev.is_green &&
      last.close > prev.open &&
      last.open < prev.close
    ) {
      return {
        type: "engulfing",
        direction: "bullish",
        probability: 55,
        candleRange: ((last.high - last.low) / last.close) * 100,
        reason: "Bullish engulfing — momentum shift",
      };
    }
  } else {
    if (
      !last.is_green &&
      prev.is_green &&
      last.close < prev.open &&
      last.open > prev.close
    ) {
      return {
        type: "engulfing",
        direction: "bearish",
        probability: 55,
        candleRange: ((last.high - last.low) / last.close) * 100,
        reason: "Bearish engulfing — momentum shift",
      };
    }
  }

  return null;
}

function detectPinBar(
  candles: ZoneCandle[],
  direction: "bullish" | "bearish",
): EntrySignal | null {
  if (candles.length < 1) return null;

  const last = candles[candles.length - 1];
  const range = last.high - last.low;
  if (range === 0) return null;

  const body = Math.abs(last.close - last.open);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  if (direction === "bullish") {
    if (lowerWick > body * 2 && upperWick < body * 0.5 && lowerWick > range * 0.6) {
      return {
        type: "pin_bar",
        direction: "bullish",
        probability: 45,
        candleRange: (range / last.close) * 100,
        reason: "Bullish pin bar — lower wick rejection",
      };
    }
  } else {
    if (upperWick > body * 2 && lowerWick < body * 0.5 && upperWick > range * 0.6) {
      return {
        type: "pin_bar",
        direction: "bearish",
        probability: 45,
        candleRange: (range / last.close) * 100,
        reason: "Bearish pin bar — upper wick rejection",
      };
    }
  }

  return null;
}

export function detectEntrySignal(
  candles: ZoneCandle[],
  direction: "bullish" | "bearish",
): EntrySignal {
  const lrc = detectLargeRangeCandle(candles, direction);
  if (lrc) return lrc;

  const engulfing = detectEngulfing(candles, direction);
  if (engulfing) return engulfing;

  const pinBar = detectPinBar(candles, direction);
  if (pinBar) return pinBar;

  return {
    type: "none",
    direction,
    probability: 0,
    candleRange: 0,
    reason: "No valid entry signal at zone",
  };
}

// ===== STEP 3: FIBONACCI =====

function computeFibonacci(swingStart: number, swingEnd: number): FibonacciLevels {
  const range = swingEnd - swingStart;

  return {
    swingStart,
    swingEnd,
    swingRange: Math.abs(range),
    ext_1_272: swingEnd + range * 0.272,
    ext_1_618: swingEnd + range * 0.618,
    ext_2_0: swingEnd + range * 1.0,
    ret_0_236: swingEnd - range * 0.236,
  };
}

// ===== STEP 4: POSITION SIZING =====

function computePositionSize(
  pair: string,
  stopDistancePips: number,
  accountSize: number = 10000,
  riskPercent: number = 1.0,
): PositionSizing {
  const riskDollars = (accountSize * riskPercent) / 100;
  const pv = pipValuePerLot(pair);

  let lots = 0;
  if (stopDistancePips > 0 && pv > 0) {
    lots = riskDollars / (stopDistancePips * pv);
  }

  return {
    accountSize,
    riskPercent,
    riskDollars: Number(riskDollars.toFixed(2)),
    stopDistancePips,
    pipValuePerLot: pv,
    lots: Number(lots.toFixed(3)),
  };
}

// ===== STEP 5: TRADE MANAGEMENT =====

function buildTradeManagement(
  direction: "long" | "short",
  zone: SupplyDemandZone,
  entry: number,
): string[] {
  const notes: string[] = [];

  if (direction === "long") {
    const beTrigger = zone.top + (zone.top - zone.bottom) * 0.5;
    notes.push(`Move SL to BE once price closes above ${beTrigger.toFixed(5)}`);
    notes.push(`Trail SL under new bullish large range candles`);
    notes.push(`Add position only at next demand zone if BE or better`);
  } else {
    const beTrigger = zone.bottom - (zone.top - zone.bottom) * 0.5;
    notes.push(`Move SL to BE once price closes below ${beTrigger.toFixed(5)}`);
    notes.push(`Trail SL above new bearish large range candles`);
    notes.push(`Add position only at next supply zone if BE or better`);
  }

  return notes;
}

// ===== MAIN ENTRY POINT =====

export function runZoneStrategy(
  pair: string,
  candles: ZoneCandle[],
  mtf5: ZoneCandle[] | null = null,
  mtf15: ZoneCandle[] | null = null,
): ZoneSignal {
  const pipSize = calcPipSize(pair);
  const currentPrice = candles[candles.length - 1].close;

  const zones = detectZones(candles);

  const atZone = zones.find((z) => z.atZone);

  if (!atZone) {
    const nearest = zones[0];

    if (!nearest) {
      return {
        status: "no_setup",
        message: "No supply/demand zones detected in recent price action.",
        candleCount: candles.length,
      };
    }

    const direction =
      nearest.type === "demand"
        ? `watch for BUY at ${nearest.bottom.toFixed(5)} - ${nearest.top.toFixed(5)}`
        : `watch for SELL at ${nearest.bottom.toFixed(5)} - ${nearest.top.toFixed(5)}`;

    return {
      status: "watching",
      message: `Price not at zone. Nearest ${nearest.type} zone: ${direction}. Distance: ${nearest.distanceToPrice.toFixed(5)}`,
      zone: nearest,
      candleCount: candles.length,
    };
  }

  const direction: "long" | "short" = atZone.type === "demand" ? "long" : "short";
  const signalDirection: "bullish" | "bearish" = direction === "long" ? "bullish" : "bearish";

  const entrySignal = detectEntrySignal(candles, signalDirection);

  if (entrySignal.type === "none") {
    return {
      status: "watching",
      message: `Price at ${atZone.type} zone but no entry signal yet. Waiting for Large Range Candle, Engulfing, or Pin Bar.`,
      zone: atZone,
      direction,
      entrySignal,
      candleCount: candles.length,
    };
  }

  // Fibonacci
  let swingStart: number;
  let swingEnd: number;

  if (direction === "long") {
    swingStart = atZone.swingLow;
    swingEnd = atZone.swingHigh;
  } else {
    swingStart = atZone.swingHigh;
    swingEnd = atZone.swingLow;
  }

  const fibonacci = computeFibonacci(swingStart, swingEnd);

  // SL
  const avg = avgRange(candles);
  const buffer = avg * 0.3;

  let stopLoss: number;
  if (direction === "long") {
    const zoneEdge = atZone.bottom;
    const entryCandleLow = candles[candles.length - 1].low;
    stopLoss = Math.min(zoneEdge, entryCandleLow) - buffer;
  } else {
    const zoneEdge = atZone.top;
    const entryCandleHigh = candles[candles.length - 1].high;
    stopLoss = Math.max(zoneEdge, entryCandleHigh) + buffer;
  }

  // TPs
  const entry = currentPrice;
  let finalTp1 = fibonacci.ext_1_272;
  let finalTp2 = fibonacci.ext_1_618;
  let finalTp3 = fibonacci.ext_2_0;

  if (direction === "long") {
    if (finalTp1 <= entry) finalTp1 = entry + fibonacci.swingRange * 0.5;
    if (finalTp2 <= finalTp1) finalTp2 = entry + fibonacci.swingRange * 1.0;
    if (finalTp3 <= finalTp2) finalTp3 = entry + fibonacci.swingRange * 1.5;
  } else {
    if (finalTp1 >= entry) finalTp1 = entry - fibonacci.swingRange * 0.5;
    if (finalTp2 >= finalTp1) finalTp2 = entry - fibonacci.swingRange * 1.0;
    if (finalTp3 >= finalTp2) finalTp3 = entry - fibonacci.swingRange * 1.5;
  }

  const riskPips = Math.round(Math.abs(entry - stopLoss) / pipSize);
  const rewardPips1 = Math.round(Math.abs(finalTp1 - entry) / pipSize);
  const rewardPips2 = Math.round(Math.abs(finalTp2 - entry) / pipSize);
  const rewardPips3 = Math.round(Math.abs(finalTp3 - entry) / pipSize);

  const rr1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const rr2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const rr3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  // MTF
  let mtfConfirmed = false;
  let mtfNote = "No MTF data";

  if (mtf5 && mtf15) {
    const mtf5Signal = detectEntrySignal(mtf5, signalDirection);
    const mtf15Signal = detectEntrySignal(mtf15, signalDirection);

    if (mtf5Signal.type !== "none" && mtf15Signal.type !== "none") {
      mtfConfirmed = true;
      mtfNote = `M5 (${mtf5Signal.type}) + M15 (${mtf15Signal.type}) confirm — strong alignment`;
    } else if (mtf5Signal.type !== "none" || mtf15Signal.type !== "none") {
      mtfNote = `Partial MTF: ${mtf5Signal.type !== "none" ? "M5" : "M15"} confirms`;
    } else {
      mtfNote = "MTF shows no confirmation";
    }
  }

  const session = getSession();
  const round = nearestRoundNumber(entry, pair);
  const nearRoundNumber = round !== null && round.distancePct < 0.15;

  const confluences: string[] = [];
  confluences.push(`✅ Price at ${atZone.type} zone (${atZone.bottom.toFixed(5)} - ${atZone.top.toFixed(5)})`);
  confluences.push(`✅ Entry signal: ${entrySignal.reason} (${entrySignal.probability}% probability)`);

  if (mtfConfirmed) confluences.push(`✅ ${mtfNote}`);
  else if (mtfNote.includes("Partial")) confluences.push(`⚠️ ${mtfNote}`);

  if (session.name === "LONDON" || session.name === "NEW YORK" || session.name === "LONDON-NY OVERLAP") {
    confluences.push(`✅ ${session.name} session — ${session.weight}`);
  } else {
    confluences.push(`⚠️ ${session.name} session — ${session.weight}`);
  }

  if (nearRoundNumber && round) {
    confluences.push(`✅ Near round number ${round.level} (${round.distancePct.toFixed(2)}% away)`);
  }

  let score = entrySignal.probability;
  if (mtfConfirmed) score += 15;
  if (session.name === "LONDON-NY OVERLAP" || session.name === "LONDON" || session.name === "NEW YORK") score += 10;
  if (nearRoundNumber) score += 5;

  const confidence: "HIGH" | "MEDIUM" | "LOW" = score >= 75 ? "HIGH" : score >= 55 ? "MEDIUM" : "LOW";

  const positionSizing = computePositionSize(pair, riskPips, 10000, 1.0);
  const tradeManagement = buildTradeManagement(direction, atZone, entry);

  return {
    status: "signal",
    message: `${direction.toUpperCase()} signal at ${atZone.type} zone`,
    direction,
    zone: atZone,
    entrySignal,
    entry,
    stopLoss,
    takeProfit1: finalTp1,
    takeProfit2: finalTp2,
    takeProfit3: finalTp3,
    riskPips,
    rewardPips1,
    rewardPips2,
    rewardPips3,
    riskReward1: rr1,
    riskReward2: rr2,
    riskReward3: rr3,
    fibonacci,
    tradeManagement,
    positionSizing,
    mtfConfirmed,
    mtfNote,
    session: session.name,
    sessionWeight: session.weight,
    nearRoundNumber,
    roundNumberNote: round ? `Nearest round: ${round.level} (${round.distancePct.toFixed(2)}%)` : undefined,
    confidence,
    confluences,
    candleCount: candles.length,
  };
}