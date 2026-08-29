// src/lib/smart-money.ts

export interface OrderBlock {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  strength: number;
  description: string;
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  strength: number;
  description: string;
}

export interface LiquidityLevel {
  type: "buy_side" | "sell_side";
  price: number;
  strength: number;
  description: string;
}

// ===== ORDER BLOCKS =====

export function findOrderBlocks(prices: number[], highs: number[], lows: number[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];
  
  for (let i = 2; i < prices.length - 2; i++) {
    // Bullish Order Block: Last bearish candle before strong up move
    if (prices[i] < prices[i - 1] && prices[i + 1] > prices[i] * 1.002) {
      const blockTop = Math.max(highs[i], highs[i - 1]);
      const blockBottom = Math.min(lows[i], lows[i - 1]);
      
      orderBlocks.push({
        type: "bullish",
        top: blockTop,
        bottom: blockBottom,
        strength: 8,
        description: `Bullish order block at ${blockBottom} - ${blockTop}. Institutional buying zone.`,
      });
    }
    
    // Bearish Order Block: Last bullish candle before strong down move
    if (prices[i] > prices[i - 1] && prices[i + 1] < prices[i] * 0.998) {
      const blockTop = Math.max(highs[i], highs[i - 1]);
      const blockBottom = Math.min(lows[i], lows[i - 1]);
      
      orderBlocks.push({
        type: "bearish",
        top: blockTop,
        bottom: blockBottom,
        strength: 8,
        description: `Bearish order block at ${blockBottom} - ${blockTop}. Institutional selling zone.`,
      });
    }
  }
  
  return orderBlocks;
}

// ===== FAIR VALUE GAPS (FVG) =====

export function findFairValueGaps(prices: number[], highs: number[], lows: number[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  
  for (let i = 1; i < prices.length - 1; i++) {
    // Bullish FVG: Gap between candle 1 high and candle 3 low
    if (lows[i + 1] > highs[i - 1]) {
      fvgs.push({
        type: "bullish",
        top: lows[i + 1],
        bottom: highs[i - 1],
        strength: 7,
        description: `Bullish Fair Value Gap at ${highs[i - 1]} - ${lows[i + 1]}. Price likely to retrace here.`,
      });
    }
    
    // Bearish FVG: Gap between candle 1 low and candle 3 high
    if (highs[i - 1] < lows[i + 1]) {
      fvgs.push({
        type: "bearish",
        top: highs[i - 1],
        bottom: lows[i + 1],
        strength: 7,
        description: `Bearish Fair Value Gap at ${highs[i - 1]} - ${lows[i + 1]}. Price likely to retrace here.`,
      });
    }
  }
  
  return fvgs;
}

// ===== LIQUIDITY LEVELS =====

export function findLiquidityLevels(prices: number[], highs: number[], lows: number[]): LiquidityLevel[] {
  const liquidity: LiquidityLevel[] = [];
  
  // Buy-side liquidity (above equal highs - stops of sellers)
  for (let i = 2; i < highs.length - 1; i++) {
    if (Math.abs(highs[i] - highs[i - 1]) < highs[i] * 0.001) {
      liquidity.push({
        type: "buy_side",
        price: highs[i],
        strength: 9,
        description: `Buy-side liquidity at ${highs[i]}. Stop losses of sellers above equal highs.`,
      });
    }
  }
  
  // Sell-side liquidity (below equal lows - stops of buyers)
  for (let i = 2; i < lows.length - 1; i++) {
    if (Math.abs(lows[i] - lows[i - 1]) < lows[i] * 0.001) {
      liquidity.push({
        type: "sell_side",
        price: lows[i],
        strength: 9,
        description: `Sell-side liquidity at ${lows[i]}. Stop losses of buyers below equal lows.`,
      });
    }
  }
  
  return liquidity;
}

// ===== COMBINED SMART MONEY ANALYSIS =====

export function analyzeSmartMoney(
  prices: number[],
  highs: number[],
  lows: number[],
): {
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityLevels: LiquidityLevel[];
} {
  const orderBlocks = findOrderBlocks(prices, highs, lows);
  const fairValueGaps = findFairValueGaps(prices, highs, lows);
  const liquidityLevels = findLiquidityLevels(prices, highs, lows);
  
  return { orderBlocks, fairValueGaps, liquidityLevels };
}