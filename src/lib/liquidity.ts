// src/lib/liquidity.ts
// Detects liquidity zones where institutional stop hunts occur.
// - Buy-side liquidity: above equal highs (stops of sellers)
// - Sell-side liquidity: below equal lows (stops of buyers)
// SL should go BEYOND the nearest liquidity zone (never inside it).
// TP should go AT the next opposing liquidity zone.

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LiquidityZone {
  type: "buy_side" | "sell_side";
  price: number;          // The liquidity level
  high: number;           // Top of the zone
  low: number;            // Bottom of the zone
  touches: number;        // How many times price respected this level
  swept: boolean;         // Has price already taken this liquidity?
  strength: number;       // 0-10
  index: number;          // Candle index where it formed
}

export interface LiquidityAnalysis {
  zones: LiquidityZone[];
  nearestBuySideAbove: LiquidityZone | null;   // For SL on shorts
  nearestSellSideBelow: LiquidityZone | null;  // For SL on longs
  nextBuySideAbove: LiquidityZone[];           // For TPs on longs
  nextSellSideBelow: LiquidityZone[];          // For TPs on shorts
  atr: number;
}

// ===== HELPERS =====

function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  let total = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
    total += tr;
  }
  return total / period;
}

function findSwingPoints(candles: Candle[], lookback: number = 3) {
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

// ===== LIQUIDITY DETECTION =====

export function analyzeLiquidity(candles: Candle[]): LiquidityAnalysis {
  const emptyResult: LiquidityAnalysis = {
    zones: [],
    nearestBuySideAbove: null,
    nearestSellSideBelow: null,
    nextBuySideAbove: [],
    nextSellSideBelow: [],
    atr: 0,
  };

  if (candles.length < 30) return emptyResult;

  const atr = calculateATR(candles, 14);
  if (atr === 0) return emptyResult;

  const lastPrice = candles[candles.length - 1].close;
  const { swingHighs, swingLows } = findSwingPoints(candles, 3);
  const zones: LiquidityZone[] = [];
  const tolerance = atr * 0.15; // Two levels within 15% of ATR = equal

  // ===== BUY-SIDE LIQUIDITY (above equal highs) =====
  // Stops of sellers sit above equal highs. Price hunts these first.
  for (let i = 0; i < swingHighs.length; i++) {
    const h1 = swingHighs[i];
    let touches = 1;
    let highest = h1.price;

    for (let j = i + 1; j < swingHighs.length; j++) {
      if (Math.abs(swingHighs[j].price - h1.price) <= tolerance) {
        touches++;
        highest = Math.max(highest, swingHighs[j].price);
      }
    }

    // Check if already swept (price went above and came back)
    const swept = candles.slice(h1.index + 1).some(c => c.high > highest + tolerance);

    zones.push({
      type: "buy_side",
      price: highest,
      high: highest + tolerance,
      low: highest - tolerance,
      touches,
      swept,
      strength: Math.min(touches * 3, 10),
      index: h1.index,
    });
  }

  // ===== SELL-SIDE LIQUIDITY (below equal lows) =====
  // Stops of buyers sit below equal lows. Price hunts these first.
  for (let i = 0; i < swingLows.length; i++) {
    const l1 = swingLows[i];
    let touches = 1;
    let lowest = l1.price;

    for (let j = i + 1; j < swingLows.length; j++) {
      if (Math.abs(swingLows[j].price - l1.price) <= tolerance) {
        touches++;
        lowest = Math.min(lowest, swingLows[j].price);
      }
    }

    const swept = candles.slice(l1.index + 1).some(c => c.low < lowest - tolerance);

    zones.push({
      type: "sell_side",
      price: lowest,
      high: lowest + tolerance,
      low: lowest - tolerance,
      touches,
      swept,
      strength: Math.min(touches * 3, 10),
      index: l1.index,
    });
  }

  // Deduplicate: keep unique levels only
  const uniqueZones: LiquidityZone[] = [];
  for (const z of zones) {
    const duplicate = uniqueZones.find(
      u => u.type === z.type && Math.abs(u.price - z.price) <= tolerance
    );
    if (!duplicate) uniqueZones.push(z);
    else if (z.touches > duplicate.touches) {
      Object.assign(duplicate, z);
    }
  }

  // ===== CLASSIFY =====

  // Buy-side above current price (for SL on shorts, TPs on longs)
  const buySideAbove = uniqueZones
    .filter(z => z.type === "buy_side" && !z.swept && z.price > lastPrice)
    .sort((a, b) => a.price - b.price);

  // Sell-side below current price (for SL on longs, TPs on shorts)
  const sellSideBelow = uniqueZones
    .filter(z => z.type === "sell_side" && !z.swept && z.price < lastPrice)
    .sort((a, b) => b.price - a.price);

  return {
    zones: uniqueZones,
    nearestBuySideAbove: buySideAbove[0] || null,
    nearestSellSideBelow: sellSideBelow[0] || null,
    nextBuySideAbove: buySideAbove.slice(0, 5),
    nextSellSideBelow: sellSideBelow.slice(0, 5),
    atr,
  };
}

// ===== SL / TP PLACEMENT USING LIQUIDITY =====

export interface SlTpPlan {
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  source: "liquidity" | "atr_fallback";
  notes: string[];
}

export function placeSlTpWithLiquidity(
  direction: "long" | "short",
  entry: number,
  liquidity: LiquidityAnalysis,
  timeframeMultiplier: number = 1.0,
  minSlPercent: number = 0.003,
  maxSlPercent: number = 0.03,
  pipSize: number = 0.0001,
): SlTpPlan {
  const notes: string[] = [];
  const atr = liquidity.atr;

  if (atr === 0) {
    return atrFallback(direction, entry, minSlPercent, maxSlPercent, pipSize);
  }

  const buffer = atr * 0.3 * timeframeMultiplier; // small pad beyond liquidity
  const minSlDistance = entry * minSlPercent;
  const maxSlDistance = entry * maxSlPercent;

  let stopLoss: number;
  let tp1: number;
  let tp2: number;
  let tp3: number;
  let source: "liquidity" | "atr_fallback" = "liquidity";

  if (direction === "long") {
    // SL: below nearest sell-side liquidity (protects against stop hunts)
    const slLiquidity = liquidity.nearestSellSideBelow;
    if (slLiquidity) {
      stopLoss = slLiquidity.low - buffer;
      notes.push(`SL below sell-side liquidity at ${slLiquidity.price.toFixed(5)}`);
    } else {
      stopLoss = entry - atr * 1.5 * timeframeMultiplier;
      notes.push("SL from ATR (no liquidity below)");
      source = "atr_fallback";
    }

    // Clamp SL
    const slDist = entry - stopLoss;
    if (slDist < minSlDistance) {
      stopLoss = entry - minSlDistance;
      notes.push("SL widened to minimum %");
    } else if (slDist > maxSlDistance) {
      stopLoss = entry - maxSlDistance;
      notes.push("SL tightened to maximum %");
    }

    // TPs: at buy-side liquidity zones above
    const tpsAbove = liquidity.nextBuySideAbove;
    const slDistance = entry - stopLoss;

    if (tpsAbove.length >= 3) {
      tp1 = tpsAbove[0].price;
      tp2 = tpsAbove[1].price;
      tp3 = tpsAbove[2].price;
      notes.push(`TPs at 3 buy-side liquidity levels`);
    } else if (tpsAbove.length === 2) {
      tp1 = tpsAbove[0].price;
      tp2 = tpsAbove[1].price;
      tp3 = entry + slDistance * 4;
      notes.push(`TP1/TP2 at liquidity, TP3 at 4R`);
    } else if (tpsAbove.length === 1) {
      tp1 = tpsAbove[0].price;
      tp2 = entry + slDistance * 2.5;
      tp3 = entry + slDistance * 4;
      notes.push(`TP1 at liquidity, TP2/TP3 at ratio`);
    } else {
      tp1 = entry + slDistance * 1.5;
      tp2 = entry + slDistance * 2.5;
      tp3 = entry + slDistance * 4;
      notes.push("All TPs from ATR ratio (no liquidity above)");
    }
  } else {
    // SHORT
    const slLiquidity = liquidity.nearestBuySideAbove;
    if (slLiquidity) {
      stopLoss = slLiquidity.high + buffer;
      notes.push(`SL above buy-side liquidity at ${slLiquidity.price.toFixed(5)}`);
    } else {
      stopLoss = entry + atr * 1.5 * timeframeMultiplier;
      notes.push("SL from ATR (no liquidity above)");
      source = "atr_fallback";
    }

    const slDist = stopLoss - entry;
    if (slDist < minSlDistance) {
      stopLoss = entry + minSlDistance;
      notes.push("SL widened to minimum %");
    } else if (slDist > maxSlDistance) {
      stopLoss = entry + maxSlDistance;
      notes.push("SL tightened to maximum %");
    }

    const tpsBelow = liquidity.nextSellSideBelow;
    const slDistance = stopLoss - entry;

    if (tpsBelow.length >= 3) {
      tp1 = tpsBelow[0].price;
      tp2 = tpsBelow[1].price;
      tp3 = tpsBelow[2].price;
      notes.push(`TPs at 3 sell-side liquidity levels`);
    } else if (tpsBelow.length === 2) {
      tp1 = tpsBelow[0].price;
      tp2 = tpsBelow[1].price;
      tp3 = entry - slDistance * 4;
      notes.push(`TP1/TP2 at liquidity, TP3 at 4R`);
    } else if (tpsBelow.length === 1) {
      tp1 = tpsBelow[0].price;
      tp2 = entry - slDistance * 2.5;
      tp3 = entry - slDistance * 4;
      notes.push(`TP1 at liquidity, TP2/TP3 at ratio`);
    } else {
      tp1 = entry - slDistance * 1.5;
      tp2 = entry - slDistance * 2.5;
      tp3 = entry - slDistance * 4;
      notes.push("All TPs from ATR ratio (no liquidity below)");
    }
  }

  // Sanity: TPs must be beyond entry in the right direction
  if (direction === "long") {
    if (tp1 <= entry || tp2 <= tp1 || tp3 <= tp2) {
      const slDist = entry - stopLoss;
      tp1 = entry + slDist * 1.5;
      tp2 = entry + slDist * 2.5;
      tp3 = entry + slDist * 4;
      notes.push("TPs reset to ratio (invalid liquidity order)");
      source = "atr_fallback";
    }
  } else {
    if (tp1 >= entry || tp2 >= tp1 || tp3 >= tp2) {
      const slDist = stopLoss - entry;
      tp1 = entry - slDist * 1.5;
      tp2 = entry - slDist * 2.5;
      tp3 = entry - slDist * 4;
      notes.push("TPs reset to ratio (invalid liquidity order)");
      source = "atr_fallback";
    }
  }

  return { stopLoss, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3, source, notes };
}

function atrFallback(
  direction: "long" | "short",
  entry: number,
  minSlPercent: number,
  maxSlPercent: number,
  pipSize: number,
): SlTpPlan {
  const slPercent = Math.min(Math.max(minSlPercent, 0.005), maxSlPercent);
  const slDist = entry * slPercent;

  let stopLoss: number, tp1: number, tp2: number, tp3: number;
  if (direction === "long") {
    stopLoss = entry - slDist;
    tp1 = entry + slDist * 1.5;
    tp2 = entry + slDist * 2.5;
    tp3 = entry + slDist * 4;
  } else {
    stopLoss = entry + slDist;
    tp1 = entry - slDist * 1.5;
    tp2 = entry - slDist * 2.5;
    tp3 = entry - slDist * 4;
  }

  return {
    stopLoss,
    takeProfit1: tp1,
    takeProfit2: tp2,
    takeProfit3: tp3,
    source: "atr_fallback",
    notes: ["Used ATR percentage fallback"],
  };
}

// ===== CONVERT FROM CLOSES (for compatibility) =====

export function candlesFromCloses(prices: number[]): Candle[] {
  return prices.map((close, i) => {
    const prev = i > 0 ? prices[i - 1] : close;
    const open = prev;
    const high = Math.max(open, close) * 1.0005;
    const low = Math.min(open, close) * 0.9995;
    return { open, high, low, close };
  });
}