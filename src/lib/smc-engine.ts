// src/lib/smc-engine.ts
// Smart Money Concepts Engine
// Supply/Demand, Order Blocks, Fair Value Gaps, Liquidity, BOS/CHoCH

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SMCOrderBlock {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  mid: number;
  strength: number;       // 0-10
  mitigated: boolean;     // has price already returned
  index: number;
}

export interface SMCFairValueGap {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  mid: number;
  strength: number;
  mitigated: boolean;
  index: number;
}

export interface SMCSupplyDemandZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  mid: number;
  strength: number;
  fresh: boolean;         // never touched since formation
  index: number;
}

export interface SMCLiquidity {
  type: "buy_side" | "sell_side";   // buy-side = above highs, sell-side = below lows
  price: number;
  strength: number;
  swept: boolean;
  touches: number;                  // how many times it was hit
  index: number;
}

export interface SMCStructure {
  bias: "bullish" | "bearish" | "ranging";
  lastBOS: "bullish" | "bearish" | "none";   // Break of Structure
  lastCHoCH: "bullish" | "bearish" | "none"; // Change of Character
  swingHighs: number[];
  swingLows: number[];
}

export interface SMCAnalysis {
  structure: SMCStructure;
  orderBlocks: SMCOrderBlock[];
  fairValueGaps: SMCFairValueGap[];
  supplyDemandZones: SMCSupplyDemandZone[];
  liquidity: SMCLiquidity[];
  // Best levels for this setup
  bestEntry: number | null;
  bestStopLoss: number | null;
  bestTPs: number[];
  smcScore: number;              // 0-100
  smcConfluences: string[];
}

// ===== HELPERS =====

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

function avgRange(candles: Candle[]): number {
  const last = candles.slice(-20);
  const ranges = last.map(c => c.high - c.low);
  return ranges.reduce((s, r) => s + r, 0) / ranges.length;
}

// ===== MARKET STRUCTURE =====

function analyzeStructure(candles: Candle[]): SMCStructure {
  const { swingHighs, swingLows } = findSwingPoints(candles, 3);
  const recentHighs = swingHighs.slice(-5);
  const recentLows = swingLows.slice(-5);

  if (recentHighs.length < 2 || recentLows.length < 2) {
    return { bias: "ranging", lastBOS: "none", lastCHoCH: "none", swingHighs: [], swingLows: [] };
  }

  const lastClose = candles[candles.length - 1].close;

  // Determine BOS: has price broken the most recent swing high or low?
  let lastBOS: "bullish" | "bearish" | "none" = "none";
  const lastHigh = recentHighs[recentHighs.length - 1].price;
  const lastLow = recentLows[recentLows.length - 1].price;
  const prevHigh = recentHighs[recentHighs.length - 2].price;
  const prevLow = recentLows[recentLows.length - 2].price;

  if (lastClose > lastHigh) lastBOS = "bullish";
  else if (lastClose < lastLow) lastBOS = "bearish";

  // CHoCH: has the trend direction flipped? (higher high then lower low, or vice versa)
  let lastCHoCH: "bullish" | "bearish" | "none" = "none";
  if (lastHigh > prevHigh && lastLow < prevLow) {
    lastCHoCH = "bearish";
  } else if (lastLow > prevLow && lastHigh < prevHigh) {
    lastCHoCH = "bullish";
  }

  // Bias
  let bias: "bullish" | "bearish" | "ranging" = "ranging";
  const higherHighs = recentHighs.every((h, i) => i === 0 || h.price >= recentHighs[i - 1].price);
  const higherLows = recentLows.every((l, i) => i === 0 || l.price >= recentLows[i - 1].price);
  const lowerHighs = recentHighs.every((h, i) => i === 0 || h.price <= recentHighs[i - 1].price);
  const lowerLows = recentLows.every((l, i) => i === 0 || l.price <= recentLows[i - 1].price);

  if (higherHighs && higherLows) bias = "bullish";
  else if (lowerHighs && lowerLows) bias = "bearish";

  return {
    bias,
    lastBOS,
    lastCHoCH,
    swingHighs: recentHighs.map(s => s.price),
    swingLows: recentLows.map(s => s.price),
  };
}

// ===== ORDER BLOCKS =====

function findOrderBlocks(candles: Candle[]): SMCOrderBlock[] {
  const blocks: SMCOrderBlock[] = [];
  const atr = avgRange(candles);
  const lastPrice = candles[candles.length - 1].close;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Bullish OB: last bearish candle before a strong bullish move
    if (prev.close < prev.open && next.close > curr.high && (next.close - next.open) > atr * 1.2) {
      const top = Math.max(prev.high, curr.high);
      const bottom = Math.min(prev.low, curr.low);
      const mitigated = candles.slice(i + 1).some(c => c.low <= bottom);
      blocks.push({
        type: "bullish",
        top,
        bottom,
        mid: (top + bottom) / 2,
        strength: mitigated ? 5 : 8,
        mitigated,
        index: i,
      });
    }

    // Bearish OB: last bullish candle before a strong bearish move
    if (prev.close > prev.open && next.close < curr.low && (next.open - next.close) > atr * 1.2) {
      const top = Math.max(prev.high, curr.high);
      const bottom = Math.min(prev.low, curr.low);
      const mitigated = candles.slice(i + 1).some(c => c.high >= top);
      blocks.push({
        type: "bearish",
        top,
        bottom,
        mid: (top + bottom) / 2,
        strength: mitigated ? 5 : 8,
        mitigated,
        index: i,
      });
    }
  }

  // Filter: keep only the most recent 6 blocks near current price
  return blocks
    .filter(b => Math.abs(b.mid - lastPrice) < atr * 20)
    .slice(-6);
}

// ===== FAIR VALUE GAPS =====

function findFairValueGaps(candles: Candle[]): SMCFairValueGap[] {
  const fvgs: SMCFairValueGap[] = [];
  const atr = avgRange(candles);

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG: gap between c1.high and c3.low (candle in middle moved up)
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const gap = top - bottom;
      if (gap > atr * 0.3) {
        const mitigated = candles.slice(i + 1).some(c => c.low <= bottom);
        fvgs.push({
          type: "bullish",
          top, bottom,
          mid: (top + bottom) / 2,
          strength: mitigated ? 5 : 8,
          mitigated,
          index: i,
        });
      }
    }

    // Bearish FVG: gap between c3.high and c1.low
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      const gap = top - bottom;
      if (gap > atr * 0.3) {
        const mitigated = candles.slice(i + 1).some(c => c.high >= top);
        fvgs.push({
          type: "bearish",
          top, bottom,
          mid: (top + bottom) / 2,
          strength: mitigated ? 5 : 8,
          mitigated,
          index: i,
        });
      }
    }
  }

  return fvgs.slice(-6);
}

// ===== SUPPLY & DEMAND ZONES =====

function findSupplyDemand(candles: Candle[]): SMCSupplyDemandZone[] {
  const zones: SMCSupplyDemandZone[] = [];
  const atr = avgRange(candles);
  const lastPrice = candles[candles.length - 1].close;

  // Base candles (small body) followed by explosive move
  for (let i = 2; i < candles.length - 2; i++) {
    const base = candles[i];
    const baseBody = Math.abs(base.close - base.open);
    const next = candles[i + 1];
    const nextBody = Math.abs(next.close - next.open);

    if (baseBody < atr * 0.4 && nextBody > atr * 1.5) {
      const top = Math.max(base.high, candles[i - 1].high);
      const bottom = Math.min(base.low, candles[i - 1].low);

      // Determine type
      const isDemand = next.close > next.open && bottom < lastPrice;
      const isSupply = next.close < next.open && top > lastPrice;

      if (isDemand || isSupply) {
        const fresh = !candles.slice(i + 2).some(c => 
          isDemand ? c.low <= bottom : c.high >= top
        );
        zones.push({
          type: isDemand ? "demand" : "supply",
          top, bottom,
          mid: (top + bottom) / 2,
          strength: fresh ? 9 : 6,
          fresh,
          index: i,
        });
      }
    }
  }

  return zones.filter(z => Math.abs(z.mid - lastPrice) < atr * 25).slice(-6);
}

// ===== LIQUIDITY LEVELS =====

function findLiquidity(candles: Candle[], lookback: number = 3): SMCLiquidity[] {
  const liq: SMCLiquidity[] = [];
  const { swingHighs, swingLows } = findSwingPoints(candles, lookback);
  const atr = avgRange(candles);

  // Buy-side liquidity: equal or near-equal highs (stops of sellers)
  for (let i = 0; i < swingHighs.length; i++) {
    const h1 = swingHighs[i];
    let touches = 1;
    for (let j = i + 1; j < swingHighs.length; j++) {
      if (Math.abs(swingHighs[j].price - h1.price) < atr * 0.15) touches++;
    }
    const swept = candles.slice(h1.index + 1).some(c => c.high > h1.price + atr * 0.05);
    liq.push({
      type: "buy_side",
      price: h1.price,
      strength: Math.min(touches * 2, 10),
      swept,
      touches,
      index: h1.index,
    });
  }

  // Sell-side liquidity: equal or near-equal lows (stops of buyers)
  for (let i = 0; i < swingLows.length; i++) {
    const l1 = swingLows[i];
    let touches = 1;
    for (let j = i + 1; j < swingLows.length; j++) {
      if (Math.abs(swingLows[j].price - l1.price) < atr * 0.15) touches++;
    }
    const swept = candles.slice(l1.index + 1).some(c => c.low < l1.price - atr * 0.05);
    liq.push({
      type: "sell_side",
      price: l1.price,
      strength: Math.min(touches * 2, 10),
      swept,
      touches,
      index: l1.index,
    });
  }

  // Keep only unswept liquidity near current price
  const lastPrice = candles[candles.length - 1].close;
  return liq
    .filter(l => !l.swept && Math.abs(l.price - lastPrice) < atr * 30)
    .slice(-8);
}

// ===== SMC SCORING =====

function scoreSMC(
  direction: "long" | "short",
  entry: number,
  ob: SMCOrderBlock[],
  fvg: SMCFairValueGap[],
  sd: SMCSupplyDemandZone[],
  liq: SMCLiquidity[],
  structure: SMCStructure,
  atr: number,
): { score: number; confluences: string[]; bestEntry: number | null; bestSL: number | null; tps: number[] } {
  let score = 0;
  const confluences: string[] = [];

  // Structure alignment
  if (direction === "long" && structure.bias === "bullish") {
    score += 20; confluences.push("✅ Bullish market structure");
  } else if (direction === "short" && structure.bias === "bearish") {
    score += 20; confluences.push("✅ Bearish market structure");
  } else if (structure.bias === "ranging") {
    score += 5; confluences.push("⚠️ Ranging market");
  }

  // BOS / CHoCH
  if (structure.lastBOS === (direction === "long" ? "bullish" : "bearish")) {
    score += 15; confluences.push(`✅ BOS confirms ${direction}`);
  }
  if (structure.lastCHoCH === (direction === "long" ? "bullish" : "bearish")) {
    score += 10; confluences.push(`✅ CHoCH confirms ${direction}`);
  }

  // Order Block confluence
  const relevantOBs = ob.filter(b => b.type === (direction === "long" ? "bullish" : "bearish") && !b.mitigated);
  const entryOB = relevantOBs
    .filter(b => direction === "long" ? b.mid <= entry : b.mid >= entry)
    .sort((a, b) => Math.abs(a.mid - entry) - Math.abs(b.mid - entry))[0];

  if (entryOB) {
    score += 15; confluences.push(`✅ Unmitigated OB at ${entryOB.mid.toFixed(5)}`);
  }

  // FVG confluence
  const relevantFVGs = fvg.filter(f => f.type === (direction === "long" ? "bullish" : "bearish") && !f.mitigated);
  const entryFVG = relevantFVGs
    .filter(f => direction === "long" ? f.mid <= entry : f.mid >= entry)
    .sort((a, b) => Math.abs(a.mid - entry) - Math.abs(b.mid - entry))[0];

  if (entryFVG) {
    score += 10; confluences.push(`✅ Unmitigated FVG at ${entryFVG.mid.toFixed(5)}`);
  }

  // Supply/Demand zone
  const relevantSD = sd.filter(z => z.type === (direction === "long" ? "demand" : "supply") && z.fresh);
  if (relevantSD.length > 0) {
    score += 15; confluences.push(`✅ Fresh ${direction === "long" ? "demand" : "supply"} zone`);
  }

  // Liquidity for TP targets
  const opposingLiq = liq.filter(l => 
    direction === "long" ? l.type === "buy_side" && l.price > entry : 
    l.type === "sell_side" && l.price < entry
  ).sort((a, b) => direction === "long" ? a.price - b.price : b.price - a.price);

  if (opposingLiq.length > 0) {
    score += 10; confluences.push(`✅ ${opposingLiq.length} opposing liquidity targets`);
  }

  // ==== SMC-BASED SL/TP PLACEMENT ====

  // Entry: best confluence zone closest to price
  let bestEntry = entry;
  if (entryOB && entryFVG) {
    // Use the closer of the two
    const obDist = Math.abs(entryOB.mid - entry);
    const fvgDist = Math.abs(entryFVG.mid - entry);
    bestEntry = obDist < fvgDist ? entryOB.mid : entryFVG.mid;
    confluences.push(`🎯 Entry at OB+FVG confluence`);
  } else if (entryOB) {
    bestEntry = entryOB.mid;
    confluences.push(`🎯 Entry at order block`);
  } else if (entryFVG) {
    bestEntry = entryFVG.mid;
    confluences.push(`🎯 Entry at fair value gap`);
  }

  // SL: below liquidity for long, above for short. Fallback: beyond zone with buffer
  let bestSL: number | null = null;
  const protectiveLiq = liq.filter(l =>
    direction === "long" ? l.type === "sell_side" && l.price < bestEntry :
    l.type === "buy_side" && l.price > bestEntry
  ).sort((a, b) => direction === "long" ? b.price - a.price : a.price - b.price)[0];

  if (protectiveLiq) {
    bestSL = direction === "long" 
      ? protectiveLiq.price - atr * 0.3 
      : protectiveLiq.price + atr * 0.3;
    confluences.push(`🛑 SL placed beyond liquidity at ${protectiveLiq.price.toFixed(5)}`);
  } else if (entryOB) {
    bestSL = direction === "long" ? entryOB.bottom - atr * 0.3 : entryOB.top + atr * 0.3;
    confluences.push(`🛑 SL beyond order block`);
  }

  // TPs: at opposing liquidity levels
  const tps: number[] = [];
  for (const l of opposingLiq.slice(0, 3)) {
    tps.push(direction === "long" ? l.price - atr * 0.1 : l.price + atr * 0.1);
  }
  if (tps.length > 0) confluences.push(`🎯 ${tps.length} TPs at liquidity levels`);

  return { score: Math.min(score, 100), confluences, bestEntry, bestSL, tps };
}

// ===== MAIN ENTRY POINT =====

export function analyzeSMC(candles: Candle[]): SMCAnalysis {
  if (candles.length < 30) {
    return {
      structure: { bias: "ranging", lastBOS: "none", lastCHoCH: "none", swingHighs: [], swingLows: [] },
      orderBlocks: [],
      fairValueGaps: [],
      supplyDemandZones: [],
      liquidity: [],
      bestEntry: null,
      bestStopLoss: null,
      bestTPs: [],
      smcScore: 0,
      smcConfluences: [],
    };
  }

  const structure = analyzeStructure(candles);
  const orderBlocks = findOrderBlocks(candles);
  const fairValueGaps = findFairValueGaps(candles);
  const supplyDemandZones = findSupplyDemand(candles);
  const liquidity = findLiquidity(candles, 3);

  return {
    structure,
    orderBlocks,
    fairValueGaps,
    supplyDemandZones,
    liquidity,
    bestEntry: null,
    bestStopLoss: null,
    bestTPs: [],
    smcScore: 0,
    smcConfluences: [],
  };
}

export function analyzeSMCForDirection(
  candles: Candle[],
  direction: "long" | "short",
  entry: number,
): { score: number; confluences: string[]; bestEntry: number; bestSL: number | null; tps: number[] } {
  const analysis = analyzeSMC(candles);
  const atr = avgRange(candles);

  const result = scoreSMC(
    direction,
    entry,
    analysis.orderBlocks,
    analysis.fairValueGaps,
    analysis.supplyDemandZones,
    analysis.liquidity,
    analysis.structure,
    atr,
  );

  return {
    score: result.score,
    confluences: result.confluences,
    bestEntry: result.bestEntry ?? entry,
    bestSL: result.bestSL,
    tps: result.tps,
  };
}

export function candlesFromCloses(prices: number[]): Candle[] {
  return prices.map((close, i) => {
    const prev = i > 0 ? prices[i - 1] : close;
    const open = prev;
    const high = Math.max(open, close) * 1.0005;
    const low = Math.min(open, close) * 0.9995;
    return { time: i, open, high, low, close };
  });
}