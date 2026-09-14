// src/lib/smc-analysis.ts
// Pure SMC signal builder.
// Input: OHLC candles from Python (FCS API).
// Output: direction, entry, SL, TP1-3, liquidity-based.

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
  candleCount: number;
}

// ===== PIP SIZE =====

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

// ===== SWING DETECTION =====

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

function detectLiquidity(candles: SMCCandle[]): SMCLiquidity[] {
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

    if (!swept) {
      liquidity.push({ type: "buy_side", price: highest, touches, index: h1.index });
    }
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

    if (!swept) {
      liquidity.push({ type: "sell_side", price: lowest, touches, index: l1.index });
    }
  }

  return liquidity;
}

// ===== ORDER BLOCKS =====

function detectOrderBlocks(candles: SMCCandle[]): SMCOrderBlock[] {
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

function detectFVGs(candles: SMCCandle[]): SMCFVG[] {
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

// ===== DIRECTION =====

function determineDirection(
  candles: SMCCandle[],
  liquidity: SMCLiquidity[],
  obs: SMCOrderBlock[],
  fvgs: SMCFVG[],
  currentPrice: number,
): { direction: "long" | "short" | "neutral"; score: number; confluences: string[] } {
  const confluences: string[] = [];
  let longScore = 0;
  let shortScore = 0;

  const buyAbove = liquidity
    .filter(l => l.type === "buy_side" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  const sellBelow = liquidity
    .filter(l => l.type === "sell_side" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  const nearestBuy = buyAbove[0];
  const nearestSell = sellBelow[0];

  const distToBuy = nearestBuy ? Math.abs(nearestBuy.price - currentPrice) : Infinity;
  const distToSell = nearestSell ? Math.abs(nearestSell.price - currentPrice) : Infinity;

  if (distToBuy < distToSell) {
    longScore += 20;
    confluences.push(`✅ Buy-side liquidity closer (${nearestBuy!.price.toFixed(5)})`);
  } else if (distToSell < distToBuy) {
    shortScore += 20;
    confluences.push(`✅ Sell-side liquidity closer (${nearestSell!.price.toFixed(5)})`);
  } else {
    confluences.push(`⚠️ No clear liquidity draw`);
  }

  const recent = candles.slice(-5);
  const greenCount = recent.filter(c => c.is_green).length;
  const redCount = recent.length - greenCount;

  if (greenCount >= 4) {
    longScore += 15;
    confluences.push(`✅ Recent structure bullish (${greenCount}/${recent.length})`);
  } else if (redCount >= 4) {
    shortScore += 15;
    confluences.push(`✅ Recent structure bearish (${redCount}/${recent.length})`);
  }

  const bullishOBs = obs.filter(o => o.type === "bullish" && o.top < currentPrice);
  const bearishOBs = obs.filter(o => o.type === "bearish" && o.bottom > currentPrice);
  if (bullishOBs.length > 0) {
    longScore += 10;
    confluences.push(`✅ Bullish OB below price (${bullishOBs.length})`);
  }
  if (bearishOBs.length > 0) {
    shortScore += 10;
    confluences.push(`✅ Bearish OB above price (${bearishOBs.length})`);
  }

  const bullishFVGs = fvgs.filter(f => f.type === "bullish" && f.bottom < currentPrice);
  const bearishFVGs = fvgs.filter(f => f.type === "bearish" && f.top > currentPrice);
  if (bullishFVGs.length > 0) {
    longScore += 10;
    confluences.push(`✅ Bullish FVG below price (${bullishFVGs.length})`);
  }
  if (bearishFVGs.length > 0) {
    shortScore += 10;
    confluences.push(`✅ Bearish FVG above price (${bearishFVGs.length})`);
  }

  if (nearestBuy && nearestBuy.touches >= 2) {
    longScore += 5;
    confluences.push(`✅ Strong buy-side liquidity (${nearestBuy.touches} touches)`);
  }
  if (nearestSell && nearestSell.touches >= 2) {
    shortScore += 5;
    confluences.push(`✅ Strong sell-side liquidity (${nearestSell.touches} touches)`);
  }

  const diff = Math.abs(longScore - shortScore);
  if (diff < 5) {
    return {
      direction: "neutral",
      score: 0,
      confluences: [...confluences, "⚠️ Long/short scores too close"],
    };
  }

  const direction = longScore > shortScore ? "long" : "short";
  return {
    direction,
    score: Math.min(Math.max(longScore, shortScore), 100),
    confluences,
  };
}

// ===== SL / TP =====

function placeSLTP(
  direction: "long" | "short",
  entry: number,
  liquidity: SMCLiquidity[],
  obs: SMCOrderBlock[],
  candles: SMCCandle[],
  pipSize: number,
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
    const bullishOBs = obs
      .filter(o => o.type === "bullish" && o.bottom < entry)
      .sort((a, b) => b.bottom - a.bottom);

    if (sellBelow.length > 0) {
      stopLoss = sellBelow[0].price - buffer;
      notes.push(`SL below sell-side liquidity at ${sellBelow[0].price.toFixed(5)}`);
    } else if (bullishOBs.length > 0) {
      stopLoss = bullishOBs[0].bottom - buffer;
      notes.push(`SL below bullish OB at ${bullishOBs[0].bottom.toFixed(5)}`);
    } else {
      stopLoss = entry - atrRange * 2;
      notes.push(`SL from ATR (no liquidity or OB below)`);
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
      tp1 = entry + (entry - stopLoss) * 1.5;
      tp2 = entry + (entry - stopLoss) * 2.5;
      tp3 = entry + (entry - stopLoss) * 4;
      notes.push(`TPs from ratio (no liquidity above)`);
    }
  } else {
    const buyAbove = liquidity
      .filter(l => l.type === "buy_side" && l.price > entry)
      .sort((a, b) => a.price - b.price);
    const bearishOBs = obs
      .filter(o => o.type === "bearish" && o.top > entry)
      .sort((a, b) => a.top - b.top);

    if (buyAbove.length > 0) {
      stopLoss = buyAbove[0].price + buffer;
      notes.push(`SL above buy-side liquidity at ${buyAbove[0].price.toFixed(5)}`);
    } else if (bearishOBs.length > 0) {
      stopLoss = bearishOBs[0].top + buffer;
      notes.push(`SL above bearish OB at ${bearishOBs[0].top.toFixed(5)}`);
    } else {
      stopLoss = entry + atrRange * 2;
      notes.push(`SL from ATR (no liquidity or OB above)`);
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
      tp1 = entry - (stopLoss - entry) * 1.5;
      tp2 = entry - (stopLoss - entry) * 2.5;
      tp3 = entry - (stopLoss - entry) * 4;
      notes.push(`TPs from ratio (no liquidity below)`);
    }
  }

  // Sanity
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
): SMCSignal | null {
  if (!candles || candles.length < 20) return null;

  const currentPrice = candles[candles.length - 1].close;
  const pipSize = calcPipSize(pair);

  const liquidity = detectLiquidity(candles);
  const obs = detectOrderBlocks(candles);
  const fvgs = detectFVGs(candles);

  const decision = determineDirection(candles, liquidity, obs, fvgs, currentPrice);

  if (decision.direction === "neutral") {
    return {
      direction: "neutral",
      entry: currentPrice,
      stopLoss: 0, takeProfit1: 0, takeProfit2: 0, takeProfit3: 0,
      riskPips: 0, rewardPips1: 0, rewardPips2: 0, rewardPips3: 0,
      riskReward1: "0", riskReward2: "0", riskReward3: "0",
      confidence: "NEUTRAL",
      score: 0,
      confluences: decision.confluences,
      smcSource: "live_data",
      liquidityZones: liquidity,
      orderBlocks: obs,
      fvgs,
      candleCount: candles.length,
    };
  }

  const levels = placeSLTP(decision.direction, currentPrice, liquidity, obs, candles, pipSize);

  const riskPips = Math.round(Math.abs(currentPrice - levels.stopLoss) / pipSize);
  const rewardPips1 = Math.round(Math.abs(levels.tp1 - currentPrice) / pipSize);
  const rewardPips2 = Math.round(Math.abs(levels.tp2 - currentPrice) / pipSize);
  const rewardPips3 = Math.round(Math.abs(levels.tp3 - currentPrice) / pipSize);

  const rr1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const rr2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const rr3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  if (parseFloat(rr1) < 1.2) {
    return {
      direction: "neutral",
      entry: currentPrice,
      stopLoss: 0, takeProfit1: 0, takeProfit2: 0, takeProfit3: 0,
      riskPips: 0, rewardPips1: 0, rewardPips2: 0, rewardPips3: 0,
      riskReward1: "0", riskReward2: "0", riskReward3: "0",
      confidence: "NEUTRAL",
      score: 0,
      confluences: [...decision.confluences, `❌ Rejected: TP1 R:R 1:${rr1} < 1.2`],
      smcSource: "live_data",
      liquidityZones: liquidity,
      orderBlocks: obs,
      fvgs,
      candleCount: candles.length,
    };
  }

  const confidence = decision.score >= 70 ? "HIGH" : decision.score >= 50 ? "MEDIUM" : "LOW";
  const allConfluences = [...decision.confluences, ...levels.notes.map(n => `🎯 ${n}`)];

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
    score: decision.score,
    confluences: allConfluences,
    smcSource: "live_data",
    liquidityZones: liquidity,
    orderBlocks: obs,
    fvgs,
    candleCount: candles.length,
  };
}