// src/lib/smc-analysis.ts
// Pure SMC signal builder with SMA 9/21/200 direction filter + MTF (M5/M15) confluence.

export interface SMCCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  is_green: boolean;
}

export interface SMCLiquidity {
  type: "buy_side" | "sell_side";
  price: number;
  touches: number;
  index: number;
}

export interface SMCOrderBlock {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  index: number;
}

export interface SMCFVG {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  index: number;
}

export interface SMCSupplyDemand {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  index: number;
}

export interface MTFCheck {
  timeframe: string;
  liquiditySweep: "bullish" | "bearish" | "none";
  reversal: "bullish" | "bearish" | "none";
  score: number;
  notes: string[];
}

export interface SMCSignal {
  direction: "long" | "short" | "neutral";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskPips: number;
  rewardPips1: number;
  rewardPips2: number;
  rewardPips3: number;
  riskReward1: string;
  riskReward2: string;
  riskReward3: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NEUTRAL";
  score: number;
  confluences: string[];
  smcSource: string;
  liquidityZones: SMCLiquidity[];
  orderBlocks: SMCOrderBlock[];
  fvgs: SMCFVG[];
  supplyDemandZones: SMCSupplyDemand[];
  sma9: number;
  sma21: number;
  sma200: number;
  candleCount: number;
  mtf5: MTFCheck | null;
  mtf15: MTFCheck | null;
  mtfAlignment: string;
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

function avgCandleRange(candles: SMCCandle[]): number {
  const sample = candles.slice(-30);
  const total = sample.reduce((sum, c) => sum + (c.high - c.low), 0);
  return total / sample.length;
}

export function sma(candles: SMCCandle[], period: number): number {
  if (candles.length < period) {
    const closes = candles.map(c => c.close);
    return closes.reduce((s, v) => s + v, 0) / closes.length;
  }
  const slice = candles.slice(-period);
  const sum = slice.reduce((s, c) => s + c.close, 0);
  return sum / period;
}

// ===== SWINGS =====

function detectSwings(candles: SMCCandle[], lookback: number = 3) {
  const swingHighs: { price: number; index: number }[] = [];
  const swingLows: { price: number; index: number }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (c.high <= candles[i - j].high || c.high <= candles[i + j].high) isHigh = false;
      if (c.low >= candles[i - j].low || c.low >= candles[i + j].low) isLow = false;
    }

    if (isHigh) swingHighs.push({ price: c.high, index: i });
    if (isLow) swingLows.push({ price: c.low, index: i });
  }

  return { swingHighs, swingLows };
}

// ===== LIQUIDITY =====

export function detectLiquidity(candles: SMCCandle[]): SMCLiquidity[] {
  if (candles.length < 10) return [];

  const swings = detectSwings(candles, 3);
  const avgPrice = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  const tolerance = avgPrice * 0.0015;

  const liquidity: SMCLiquidity[] = [];

  for (let i = 0; i < swings.swingHighs.length; i++) {
    const h1 = swings.swingHighs[i];
    let touches = 1;
    let highest = h1.price;

    for (let j = i + 1; j < swings.swingHighs.length; j++) {
      if (Math.abs(swings.swingHighs[j].price - h1.price) <= tolerance) {
        touches++;
        highest = Math.max(highest, swings.swingHighs[j].price);
      }
    }

    const swept = candles.slice(h1.index + 1).some(c => c.high > highest + tolerance);
    if (!swept) liquidity.push({ type: "buy_side", price: highest, touches, index: h1.index });
  }

  for (let i = 0; i < swings.swingLows.length; i++) {
    const l1 = swings.swingLows[i];
    let touches = 1;
    let lowest = l1.price;

    for (let j = i + 1; j < swings.swingLows.length; j++) {
      if (Math.abs(swings.swingLows[j].price - l1.price) <= tolerance) {
        touches++;
        lowest = Math.min(lowest, swings.swingLows[j].price);
      }
    }

    const swept = candles.slice(l1.index + 1).some(c => c.low < lowest - tolerance);
    if (!swept) liquidity.push({ type: "sell_side", price: lowest, touches, index: l1.index });
  }

  return liquidity;
}

// ===== ORDER BLOCKS =====

export function detectOrderBlocks(candles: SMCCandle[]): SMCOrderBlock[] {
  if (candles.length < 5) return [];

  const obs: SMCOrderBlock[] = [];
  const avgRange = avgCandleRange(candles);

  for (let i = 1; i < candles.length - 2; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    if (!prev.is_green && next.close > curr.high) {
      const move = next.close - next.open;
      if (move > avgRange * 1.2) {
        obs.push({
          type: "bullish",
          top: Math.max(prev.high, curr.high),
          bottom: Math.min(prev.low, curr.low),
          index: i,
        });
      }
    }

    if (prev.is_green && next.close < curr.low) {
      const move = next.open - next.close;
      if (move > avgRange * 1.2) {
        obs.push({
          type: "bearish",
          top: Math.max(prev.high, curr.high),
          bottom: Math.min(prev.low, curr.low),
          index: i,
        });
      }
    }
  }

  return obs.slice(-10);
}

// ===== FVG =====

export function detectFVGs(candles: SMCCandle[]): SMCFVG[] {
  if (candles.length < 3) return [];

  const fvgs: SMCFVG[] = [];
  const avgRange = avgCandleRange(candles);

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    if (c3.low > c1.high) {
      const gap = c3.low - c1.high;
      if (gap > avgRange * 0.3) {
        fvgs.push({ type: "bullish", top: c3.low, bottom: c1.high, index: i });
      }
    }

    if (c3.high < c1.low) {
      const gap = c1.low - c3.high;
      if (gap > avgRange * 0.3) {
        fvgs.push({ type: "bearish", top: c1.low, bottom: c3.high, index: i });
      }
    }
  }

  return fvgs.slice(-10);
}

// ===== SUPPLY / DEMAND =====

export function detectSupplyDemand(candles: SMCCandle[]): SMCSupplyDemand[] {
  if (candles.length < 5) return [];

  const zones: SMCSupplyDemand[] = [];
  const avgRange = avgCandleRange(candles);

  for (let i = 1; i < candles.length - 2; i++) {
    const base = candles[i];
    const baseBody = Math.abs(base.close - base.open);
    const next = candles[i + 1];
    const nextBody = Math.abs(next.close - next.open);

    if (baseBody > avgRange * 0.5) continue;
    if (nextBody < avgRange * 1.5) continue;

    if (next.close > next.open && next.close > base.high) {
      zones.push({ type: "demand", top: base.high, bottom: base.low, index: i });
    }

    if (next.close < next.open && next.close < base.low) {
      zones.push({ type: "supply", top: base.high, bottom: base.low, index: i });
    }
  }

  return zones.slice(-10);
}

// ===== MTF LIQUIDITY + REVERSAL DETECTION =====

export function analyzeMTF(
  candles: SMCCandle[],
  label: string,
  lookback: number = 3,
): MTFCheck {
  const notes: string[] = [];
  let score = 0;
  let liquiditySweep: "bullish" | "bearish" | "none" = "none";
  let reversal: "bullish" | "bearish" | "none" = "none";

  if (!candles || candles.length < lookback + 5) {
    return { timeframe: label, liquiditySweep: "none", reversal: "none", score: 0, notes };
  }

  const recent = candles.slice(-lookback);
  const beforeRecent = candles.slice(-(lookback * 2), -lookback);

  if (beforeRecent.length === 0) {
    return { timeframe: label, liquiditySweep: "none", reversal: "none", score: 0, notes };
  }

  // ===== LIQUIDITY SWEEP =====
  const priorLow = Math.min(...beforeRecent.map(c => c.low));
  const priorHigh = Math.max(...beforeRecent.map(c => c.high));

  for (const c of recent) {
    if (c.low < priorLow && c.close > priorLow) {
      liquiditySweep = "bullish";
      score += 15;
      notes.push(`✅ ${label}: Bullish liquidity sweep (wick below ${priorLow.toFixed(5)}, closed above)`);
      break;
    }

    if (c.high > priorHigh && c.close < priorHigh) {
      liquiditySweep = "bearish";
      score += 15;
      notes.push(`✅ ${label}: Bearish liquidity sweep (wick above ${priorHigh.toFixed(5)}, closed below)`);
      break;
    }
  }

  // ===== REVERSAL =====
  const lastCandle = recent[recent.length - 1];
  const prevCandle = beforeRecent[beforeRecent.length - 1];
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const avgBodySize = recent.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / recent.length;

  if (lastCandle.is_green && !prevCandle.is_green && lastCandle.close > prevCandle.high) {
    reversal = "bullish";
    score += 12;
    notes.push(`✅ ${label}: Bullish reversal (green closed above prior high)`);
  } else if (!lastCandle.is_green && prevCandle.is_green && lastCandle.close < prevCandle.low) {
    reversal = "bearish";
    score += 12;
    notes.push(`✅ ${label}: Bearish reversal (red closed below prior low)`);
  } else if (lastCandle.is_green && bodySize > avgBodySize * 1.8) {
    reversal = "bullish";
    score += 8;
    notes.push(`✅ ${label}: Strong bullish candle (${(bodySize / avgBodySize).toFixed(1)}x avg body)`);
  } else if (!lastCandle.is_green && bodySize > avgBodySize * 1.8) {
    reversal = "bearish";
    score += 8;
    notes.push(`✅ ${label}: Strong bearish candle (${(bodySize / avgBodySize).toFixed(1)}x avg body)`);
  }

  // ===== ENGULFING =====
  if (
    lastCandle.is_green &&
    !prevCandle.is_green &&
    lastCandle.close > prevCandle.open &&
    lastCandle.open < prevCandle.close
  ) {
    reversal = "bullish";
    score += 10;
    notes.push(`✅ ${label}: Bullish engulfing`);
  } else if (
    !lastCandle.is_green &&
    prevCandle.is_green &&
    lastCandle.close < prevCandle.open &&
    lastCandle.open > prevCandle.close
  ) {
    reversal = "bearish";
    score += 10;
    notes.push(`✅ ${label}: Bearish engulfing`);
  }

  return {
    timeframe: label,
    liquiditySweep,
    reversal,
    score: Math.min(score, 30),
    notes,
  };
}

// ===== DIRECTION =====

function determineDirection(
  candles: SMCCandle[],
  liquidity: SMCLiquidity[],
  obs: SMCOrderBlock[],
  fvgs: SMCFVG[],
  sdZones: SMCSupplyDemand[],
  currentPrice: number,
): { direction: "long" | "short"; score: number; confluences: string[] } {
  const confluences: string[] = [];
  let longScore = 0;
  let shortScore = 0;

  const sma9 = sma(candles, 9);
  const sma21 = sma(candles, 21);
  const sma200 = sma(candles, 200);

  if (sma9 > sma21) {
    longScore += 25;
    confluences.push(`✅ SMA9 (${sma9.toFixed(2)}) > SMA21 (${sma21.toFixed(2)}) — short-term bullish`);
  } else {
    shortScore += 25;
    confluences.push(`✅ SMA9 (${sma9.toFixed(2)}) < SMA21 (${sma21.toFixed(2)}) — short-term bearish`);
  }

  if (currentPrice > sma200) {
    longScore += 20;
    confluences.push(`✅ Price above SMA200 (${sma200.toFixed(2)}) — bullish bias`);
  } else {
    shortScore += 20;
    confluences.push(`✅ Price below SMA200 (${sma200.toFixed(2)}) — bearish bias`);
  }

  const buyAbove = liquidity
    .filter(l => l.type === "buy_side" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  const sellBelow = liquidity
    .filter(l => l.type === "sell_side" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  const nearestBuy = buyAbove[0];
  const nearestSell = sellBelow[0];

  const distBuy = nearestBuy ? Math.abs(nearestBuy.price - currentPrice) : Infinity;
  const distSell = nearestSell ? Math.abs(nearestSell.price - currentPrice) : Infinity;

  if (distBuy < distSell) {
    longScore += 15;
    confluences.push(`✅ Buy-side liquidity closer (${nearestBuy!.price.toFixed(5)})`);
  } else if (distSell < distBuy) {
    shortScore += 15;
    confluences.push(`✅ Sell-side liquidity closer (${nearestSell!.price.toFixed(5)})`);
  }

  const demandBelow = sdZones.filter(z => z.type === "demand" && z.top < currentPrice);
  const supplyAbove = sdZones.filter(z => z.type === "supply" && z.bottom > currentPrice);

  if (demandBelow.length > 0) {
    longScore += 10;
    confluences.push(`✅ Demand zone below (${demandBelow.length})`);
  }
  if (supplyAbove.length > 0) {
    shortScore += 10;
    confluences.push(`✅ Supply zone above (${supplyAbove.length})`);
  }

  const bullishOBs = obs.filter(o => o.type === "bullish" && o.top < currentPrice);
  const bearishOBs = obs.filter(o => o.type === "bearish" && o.bottom > currentPrice);

  if (bullishOBs.length > 0) {
    longScore += 8;
    confluences.push(`✅ Bullish OB below price (${bullishOBs.length})`);
  }
  if (bearishOBs.length > 0) {
    shortScore += 8;
    confluences.push(`✅ Bearish OB above price (${bearishOBs.length})`);
  }

  const bullishFVGs = fvgs.filter(f => f.type === "bullish" && f.bottom < currentPrice);
  const bearishFVGs = fvgs.filter(f => f.type === "bearish" && f.top > currentPrice);

  if (bullishFVGs.length > 0) {
    longScore += 5;
    confluences.push(`✅ Bullish FVG below price (${bullishFVGs.length})`);
  }
  if (bearishFVGs.length > 0) {
    shortScore += 5;
    confluences.push(`✅ Bearish FVG above price (${bearishFVGs.length})`);
  }

  const recent = candles.slice(-5);
  const greenCount = recent.filter(c => c.is_green).length;
  if (greenCount >= 4) {
    longScore += 5;
    confluences.push(`✅ Recent candles bullish (${greenCount}/${recent.length})`);
  } else if (greenCount <= 1) {
    shortScore += 5;
    confluences.push(`✅ Recent candles bearish (${recent.length - greenCount}/${recent.length})`);
  }

  const direction = longScore >= shortScore ? "long" : "short";
  const score = Math.min(Math.max(longScore, shortScore), 100);

  return { direction, score, confluences };
}

// ===== SL / TP =====

function placeSLTP(
  direction: "long" | "short",
  entry: number,
  liquidity: SMCLiquidity[],
  obs: SMCOrderBlock[],
  sdZones: SMCSupplyDemand[],
  candles: SMCCandle[],
): { stopLoss: number; tp1: number; tp2: number; tp3: number; notes: string[] } {
  const notes: string[] = [];
  const atrRange = avgCandleRange(candles);
  const buffer = atrRange * 0.5;

  let stopLoss: number;
  let tp1: number, tp2: number, tp3: number;

  if (direction === "long") {
    const sellBelow = liquidity
      .filter(l => l.type === "sell_side" && l.price < entry)
      .sort((a, b) => b.price - a.price);
    const demandBelow = sdZones
      .filter(z => z.type === "demand" && z.bottom < entry)
      .sort((a, b) => b.bottom - a.bottom);
    const bullishOBs = obs
      .filter(o => o.type === "bullish" && o.bottom < entry)
      .sort((a, b) => b.bottom - a.bottom);

    if (sellBelow.length > 0) {
      stopLoss = sellBelow[0].price - buffer;
      notes.push(`SL below sell-side liquidity at ${sellBelow[0].price.toFixed(5)}`);
    } else if (demandBelow.length > 0) {
      stopLoss = demandBelow[0].bottom - buffer;
      notes.push(`SL below demand zone at ${demandBelow[0].bottom.toFixed(5)}`);
    } else if (bullishOBs.length > 0) {
      stopLoss = bullishOBs[0].bottom - buffer;
      notes.push(`SL below bullish OB at ${bullishOBs[0].bottom.toFixed(5)}`);
    } else {
      stopLoss = entry - atrRange * 2;
      notes.push(`SL from ATR (no structural level below)`);
    }

    const buyAbove = liquidity
      .filter(l => l.type === "buy_side" && l.price > entry)
      .sort((a, b) => a.price - b.price);

    if (buyAbove.length >= 3) {
      tp1 = buyAbove[0].price;
      tp2 = buyAbove[1].price;
      tp3 = buyAbove[2].price;
      notes.push(`TPs at 3 buy-side liquidity zones`);
    } else if (buyAbove.length === 2) {
      tp1 = buyAbove[0].price;
      tp2 = buyAbove[1].price;
      tp3 = entry + (entry - stopLoss) * 4;
      notes.push(`TP1/TP2 at liquidity, TP3 at 4R`);
    } else if (buyAbove.length === 1) {
      tp1 = buyAbove[0].price;
      tp2 = entry + (entry - stopLoss) * 2.5;
      tp3 = entry + (entry - stopLoss) * 4;
      notes.push(`TP1 at liquidity, TP2/TP3 at ratio`);
    } else {
      const risk = entry - stopLoss;
      tp1 = entry + risk * 1.5;
      tp2 = entry + risk * 2.5;
      tp3 = entry + risk * 4;
      notes.push(`TPs from R:R ratio (no liquidity above)`);
    }
  } else {
    const buyAbove = liquidity
      .filter(l => l.type === "buy_side" && l.price > entry)
      .sort((a, b) => a.price - b.price);
    const supplyAbove = sdZones
      .filter(z => z.type === "supply" && z.top > entry)
      .sort((a, b) => a.top - b.top);
    const bearishOBs = obs
      .filter(o => o.type === "bearish" && o.top > entry)
      .sort((a, b) => a.top - b.top);

    if (buyAbove.length > 0) {
      stopLoss = buyAbove[0].price + buffer;
      notes.push(`SL above buy-side liquidity at ${buyAbove[0].price.toFixed(5)}`);
    } else if (supplyAbove.length > 0) {
      stopLoss = supplyAbove[0].top + buffer;
      notes.push(`SL above supply zone at ${supplyAbove[0].top.toFixed(5)}`);
    } else if (bearishOBs.length > 0) {
      stopLoss = bearishOBs[0].top + buffer;
      notes.push(`SL above bearish OB at ${bearishOBs[0].top.toFixed(5)}`);
    } else {
      stopLoss = entry + atrRange * 2;
      notes.push(`SL from ATR (no structural level above)`);
    }

    const sellBelow = liquidity
      .filter(l => l.type === "sell_side" && l.price < entry)
      .sort((a, b) => b.price - a.price);

    if (sellBelow.length >= 3) {
      tp1 = sellBelow[0].price;
      tp2 = sellBelow[1].price;
      tp3 = sellBelow[2].price;
      notes.push(`TPs at 3 sell-side liquidity zones`);
    } else if (sellBelow.length === 2) {
      tp1 = sellBelow[0].price;
      tp2 = sellBelow[1].price;
      tp3 = entry - (stopLoss - entry) * 4;
      notes.push(`TP1/TP2 at liquidity, TP3 at 4R`);
    } else if (sellBelow.length === 1) {
      tp1 = sellBelow[0].price;
      tp2 = entry - (stopLoss - entry) * 2.5;
      tp3 = entry - (stopLoss - entry) * 4;
      notes.push(`TP1 at liquidity, TP2/TP3 at ratio`);
    } else {
      const risk = stopLoss - entry;
      tp1 = entry - risk * 1.5;
      tp2 = entry - risk * 2.5;
      tp3 = entry - risk * 4;
      notes.push(`TPs from R:R ratio (no liquidity below)`);
    }
  }

  if (direction === "long") {
    if (tp1 <= entry || tp2 <= tp1 || tp3 <= tp2) {
      const risk = entry - stopLoss;
      tp1 = entry + risk * 1.5;
      tp2 = entry + risk * 2.5;
      tp3 = entry + risk * 4;
      notes.push("TPs reset — invalid order");
    }
  } else {
    if (tp1 >= entry || tp2 >= tp1 || tp3 >= tp2) {
      const risk = stopLoss - entry;
      tp1 = entry - risk * 1.5;
      tp2 = entry - risk * 2.5;
      tp3 = entry - risk * 4;
      notes.push("TPs reset — invalid order");
    }
  }

  return { stopLoss, tp1, tp2, tp3, notes };
}

// ===== MAIN =====

export function buildSMCSignal(
  pair: string,
  candles: SMCCandle[],
  mtf5Candles: SMCCandle[] | null = null,
  mtf15Candles: SMCCandle[] | null = null,
): SMCSignal | null {
  if (!candles || candles.length < 50) return null;

  const currentPrice = candles[candles.length - 1].close;
  const pipSize = calcPipSize(pair);

  const liquidity = detectLiquidity(candles);
  const obs = detectOrderBlocks(candles);
  const fvgs = detectFVGs(candles);
  const sdZones = detectSupplyDemand(candles);

  const sma9 = sma(candles, 9);
  const sma21 = sma(candles, 21);
  const sma200 = sma(candles, 200);

  const decision = determineDirection(candles, liquidity, obs, fvgs, sdZones, currentPrice);

  const levels = placeSLTP(decision.direction, currentPrice, liquidity, obs, sdZones, candles);

  const riskPips = Math.round(Math.abs(currentPrice - levels.stopLoss) / pipSize);
  const rewardPips1 = Math.round(Math.abs(levels.tp1 - currentPrice) / pipSize);
  const rewardPips2 = Math.round(Math.abs(levels.tp2 - currentPrice) / pipSize);
  const rewardPips3 = Math.round(Math.abs(levels.tp3 - currentPrice) / pipSize);

  const rr1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const rr2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const rr3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  // ===== MTF ANALYSIS =====
  const mtf5 = mtf5Candles ? analyzeMTF(mtf5Candles, "M5", 3) : null;
  const mtf15 = mtf15Candles ? analyzeMTF(mtf15Candles, "M15", 3) : null;

  let mtfScoreAdjustment = 0;
  let mtfAlignment = "none";

  if (mtf5 && mtf15) {
    const mtf5Bullish = mtf5.liquiditySweep === "bullish" || mtf5.reversal === "bullish";
    const mtf5Bearish = mtf5.liquiditySweep === "bearish" || mtf5.reversal === "bearish";
    const mtf15Bullish = mtf15.liquiditySweep === "bullish" || mtf15.reversal === "bullish";
    const mtf15Bearish = mtf15.liquiditySweep === "bearish" || mtf15.reversal === "bearish";

    const signalDirection = decision.direction;

    if (signalDirection === "long") {
      if (mtf5Bullish && mtf15Bullish) {
        mtfScoreAdjustment = +15;
        mtfAlignment = "strong_confirmation";
      } else if (mtf5Bullish || mtf15Bullish) {
        mtfScoreAdjustment = +8;
        mtfAlignment = "partial_confirmation";
      } else if (mtf5Bearish && mtf15Bearish) {
        mtfScoreAdjustment = -20;
        mtfAlignment = "conflict";
      } else if (mtf5Bearish || mtf15Bearish) {
        mtfScoreAdjustment = -10;
        mtfAlignment = "weak_conflict";
      }
    } else {
      if (mtf5Bearish && mtf15Bearish) {
        mtfScoreAdjustment = +15;
        mtfAlignment = "strong_confirmation";
      } else if (mtf5Bearish || mtf15Bearish) {
        mtfScoreAdjustment = +8;
        mtfAlignment = "partial_confirmation";
      } else if (mtf5Bullish && mtf15Bullish) {
        mtfScoreAdjustment = -20;
        mtfAlignment = "conflict";
      } else if (mtf5Bullish || mtf15Bullish) {
        mtfScoreAdjustment = -10;
        mtfAlignment = "weak_conflict";
      }
    }
  }

  const finalScore = Math.min(Math.max(decision.score + mtfScoreAdjustment, 0), 100);

  const allConfluences = [
    ...decision.confluences,
    `📊 SMA9: ${sma9.toFixed(5)} | SMA21: ${sma21.toFixed(5)} | SMA200: ${sma200.toFixed(5)}`,
    ...(mtf5 ? mtf5.notes : []),
    ...(mtf15 ? mtf15.notes : []),
    `MTF alignment: ${mtfAlignment}`,
    ...levels.notes.map(n => `🎯 ${n}`),
  ];

  const confidence = finalScore >= 70 ? "HIGH" : finalScore >= 50 ? "MEDIUM" : "LOW";

  return {
    direction: decision.direction,
    entry: currentPrice,
    stopLoss: levels.stopLoss,
    takeProfit1: levels.tp1,
    takeProfit2: levels.tp2,
    takeProfit3: levels.tp3,
    riskPips,
    rewardPips1,
    rewardPips2,
    rewardPips3,
    riskReward1: rr1,
    riskReward2: rr2,
    riskReward3: rr3,
    confidence,
    score: finalScore,
    confluences: allConfluences,
    smcSource: "live_data",
    liquidityZones: liquidity,
    orderBlocks: obs,
    fvgs,
    supplyDemandZones: sdZones,
    sma9,
    sma21,
    sma200,
    candleCount: candles.length,
    mtf5,
    mtf15,
    mtfAlignment,
  };
}