// src/lib/smc-from-image.ts
// Converts Python SMC output (candles + liquidity + OB + FVG) into a trading signal.
// Pure SMC: no indicators, no ADX filter, no MACD, no RSI.

export interface SMCCandle {
  x_pixel: number;
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

export interface PythonSMCResponse {
  status: "success" | "error";
  message?: string;
  candles?: SMCCandle[];
  liquidity?: SMCLiquidity[];
  order_blocks?: SMCOrderBlock[];
  fvgs?: SMCFVG[];
  current_price?: number;
  trend?: "bullish" | "bearish";
  y_axis?: { min: number; max: number; labels_read: number };
  candle_count?: number;
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
  // Data that goes to admin only
  liquidityZones: SMCLiquidity[];
  orderBlocks: SMCOrderBlock[];
  fvgs: SMCFVG[];
  candleCount: number;
  yAxisRange: { min: number; max: number };
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

// ===== STRUCTURE: Which direction is SMC pointing? =====

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

  // 1. Liquidity draw: nearest untouched liquidity pools
  const buySideAbove = liquidity
    .filter(l => l.type === "buy_side" && l.price > currentPrice)
    .sort((a, b) => a.price - b.price);
  const sellSideBelow = liquidity
    .filter(l => l.type === "sell_side" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price);

  const nearestBuyAbove = buySideAbove[0];
  const nearestSellBelow = sellSideBelow[0];

  const distToBuy = nearestBuyAbove ? Math.abs(nearestBuyAbove.price - currentPrice) : Infinity;
  const distToSell = nearestSellBelow ? Math.abs(nearestSellBelow.price - currentPrice) : Infinity;

  // Price is drawn to the nearest liquidity pool
  if (distToBuy < distToSell) {
    longScore += 20;
    confluences.push(`✅ Buy-side liquidity closer (${nearestBuyAbove!.price.toFixed(5)})`);
  } else if (distToSell < distToBuy) {
    shortScore += 20;
    confluences.push(`✅ Sell-side liquidity closer (${nearestSellBelow!.price.toFixed(5)})`);
  } else {
    confluences.push(`⚠️ No clear liquidity draw`);
  }

  // 2. Recent structure: last 5 candles
  const recent = candles.slice(-5);
  const greenCount = recent.filter(c => c.is_green).length;
  const redCount = recent.length - greenCount;

  if (greenCount >= 4) {
    longScore += 15;
    confluences.push(`✅ Recent structure bullish (${greenCount}/${recent.length} green)`);
  } else if (redCount >= 4) {
    shortScore += 15;
    confluences.push(`✅ Recent structure bearish (${redCount}/${recent.length} red)`);
  }

  // 3. Unmitigated order blocks in the direction of price
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

  // 4. FVGs in the direction of price
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

  // 5. Liquidity touches: stronger zones = stronger draw
  if (nearestBuyAbove && nearestBuyAbove.touches >= 2) {
    longScore += 5;
    confluences.push(`✅ Strong buy-side liquidity (${nearestBuyAbove.touches} touches)`);
  }
  if (nearestSellBelow && nearestSellBelow.touches >= 2) {
    shortScore += 5;
    confluences.push(`✅ Strong sell-side liquidity (${nearestSellBelow.touches} touches)`);
  }

  // Decision
  const diff = Math.abs(longScore - shortScore);
  if (diff < 5) {
    return { direction: "neutral", score: 0, confluences: [...confluences, "⚠️ Long/short scores too close"] };
  }

  const finalDirection = longScore > shortScore ? "long" : "short";
  const finalScore = Math.min(Math.max(longScore, shortScore), 100);

  return { direction: finalDirection, score: finalScore, confluences };
}

// ===== SL / TP PLACEMENT (PURE LIQUIDITY) =====

function placeSLTP(
  direction: "long" | "short",
  entry: number,
  liquidity: SMCLiquidity[],
  obs: SMCOrderBlock[],
  fvgs: SMCFVG[],
  candles: SMCCandle[],
  pipSize: number,
): {
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  notes: string[];
} {
  const notes: string[] = [];
  const atrRange = avgCandleRange(candles);
  const buffer = atrRange * 0.5;

  let stopLoss: number;
  let tp1: number, tp2: number, tp3: number;

  if (direction === "long") {
    // === SL: below nearest sell-side liquidity OR below last bullish OB ===
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

    // === TPs: at buy-side liquidity zones above ===
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
    // SHORT
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

  // Sanity check: TPs must be on profit side
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

// ===== MAIN ENTRY POINT =====

export function buildSMCSignal(
  pair: string,
  pythonResponse: PythonSMCResponse,
): SMCSignal | null {
  if (pythonResponse.status !== "success" ||
      !pythonResponse.candles ||
      pythonResponse.candles.length < 20) {
    return null;
  }

  const candles = pythonResponse.candles;
  const liquidity = pythonResponse.liquidity || [];
  const obs = pythonResponse.order_blocks || [];
  const fvgs = pythonResponse.fvgs || [];
  const currentPrice = pythonResponse.current_price ?? candles[candles.length - 1].close;
  const pipSize = calcPipSize(pair);

  // Determine direction from SMC
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
      smcSource: "image_smc",
      liquidityZones: liquidity,
      orderBlocks: obs,
      fvgs,
      candleCount: candles.length,
      yAxisRange: pythonResponse.y_axis
        ? { min: pythonResponse.y_axis.min, max: pythonResponse.y_axis.max }
        : { min: 0, max: 0 },
    };
  }

  // Place SL / TP using liquidity
  const levels = placeSLTP(
    decision.direction,
    currentPrice,
    liquidity,
    obs,
    fvgs,
    candles,
    pipSize,
  );

  const riskPips = Math.round(Math.abs(currentPrice - levels.stopLoss) / pipSize);
  const rewardPips1 = Math.round(Math.abs(levels.tp1 - currentPrice) / pipSize);
  const rewardPips2 = Math.round(Math.abs(levels.tp2 - currentPrice) / pipSize);
  const rewardPips3 = Math.round(Math.abs(levels.tp3 - currentPrice) / pipSize);

  const rr1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const rr2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const rr3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  // Reject weak signals: R:R < 1.2 for TP1
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
      smcSource: "image_smc",
      liquidityZones: liquidity,
      orderBlocks: obs,
      fvgs,
      candleCount: candles.length,
      yAxisRange: pythonResponse.y_axis
        ? { min: pythonResponse.y_axis.min, max: pythonResponse.y_axis.max }
        : { min: 0, max: 0 },
    };
  }

  const confidence = decision.score >= 70 ? "HIGH" : decision.score >= 50 ? "MEDIUM" : "LOW";

  // Add SL/TP placement notes to confluences
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
    smcSource: "image_smc",
    liquidityZones: liquidity,
    orderBlocks: obs,
    fvgs,
    candleCount: candles.length,
    yAxisRange: pythonResponse.y_axis
      ? { min: pythonResponse.y_axis.min, max: pythonResponse.y_axis.max }
      : { min: 0, max: 0 },
  };
}