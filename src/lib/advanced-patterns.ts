// src/lib/advanced-patterns.ts

export interface ChartPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  strength: number; // 0-10
  description: string;
}

export interface SupplyDemandZone {
  type: "supply" | "demand";
  top: number;
  bottom: number;
  strength: number;
  description: string;
}

// ===== SUPPLY & DEMAND ZONES =====

export function findSupplyDemandZones(prices: number[], highs: number[], lows: number[]): SupplyDemandZone[] {
  const zones: SupplyDemandZone[] = [];
  
  if (prices.length < 10) return zones;
  
  // Look for consolidation areas (tight ranges) = supply/demand zones
  for (let i = 2; i < prices.length - 2; i++) {
    const range = highs[i] - lows[i];
    const avgRange = calculateAverageRange(highs, lows, i);
    
    // Tight range = consolidation = supply/demand zone
    if (range < avgRange * 0.5) {
      const zoneTop = highs[i];
      const zoneBottom = lows[i];
      const currentPrice = prices[prices.length - 1];
      
      if (zoneTop < currentPrice) {
        // Below current price = demand zone (support)
        zones.push({
          type: "demand",
          top: zoneTop,
          bottom: zoneBottom,
          strength: 7,
          description: `Demand zone at ${zoneBottom} - ${zoneTop}. Institutional buying area.`,
        });
      } else if (zoneBottom > currentPrice) {
        // Above current price = supply zone (resistance)
        zones.push({
          type: "supply",
          top: zoneTop,
          bottom: zoneBottom,
          strength: 7,
          description: `Supply zone at ${zoneBottom} - ${zoneTop}. Institutional selling area.`,
        });
      }
    }
  }
  
  // Remove duplicates and sort by strength
  return zones.filter((zone, index, self) => 
    index === self.findIndex(z => 
      Math.abs(z.top - zone.top) < (zone.top - zone.bottom) && 
      z.type === zone.type
    )
  );
}

function calculateAverageRange(highs: number[], lows: number[], currentIndex: number): number {
  let total = 0;
  const start = Math.max(0, currentIndex - 5);
  const end = Math.min(highs.length, currentIndex + 5);
  
  for (let i = start; i < end; i++) {
    total += highs[i] - lows[i];
  }
  
  return total / (end - start);
}

// ===== CHART PATTERNS =====

export function detectChartPatterns(prices: number[], highs: number[], lows: number[]): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  
  if (prices.length < 20) return patterns;
  
  const currentPrice = prices[prices.length - 1];
  const recentPrices = prices.slice(-20);
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  
  // Double Top
  const doubleTop = detectDoubleTop(recentHighs, currentPrice);
  if (doubleTop) patterns.push(doubleTop);
  
  // Double Bottom
  const doubleBottom = detectDoubleBottom(recentLows, currentPrice);
  if (doubleBottom) patterns.push(doubleBottom);
  
  // Head and Shoulders
  const headShoulders = detectHeadAndShoulders(recentHighs, currentPrice);
  if (headShoulders) patterns.push(headShoulders);
  
  // Ascending Triangle
  const ascTriangle = detectAscendingTriangle(recentHighs, recentLows);
  if (ascTriangle) patterns.push(ascTriangle);
  
  // Descending Triangle
  const descTriangle = detectDescendingTriangle(recentHighs, recentLows);
  if (descTriangle) patterns.push(descTriangle);
  
  // Bullish Flag
  const bullFlag = detectBullFlag(recentPrices);
  if (bullFlag) patterns.push(bullFlag);
  
  // Bearish Flag
  const bearFlag = detectBearFlag(recentPrices);
  if (bearFlag) patterns.push(bearFlag);
  
  return patterns;
}

function detectDoubleTop(highs: number[], currentPrice: number): ChartPattern | null {
  if (highs.length < 10) return null;
  
  const highest = Math.max(...highs.slice(0, -3));
  const recentHigh = Math.max(...highs.slice(-3));
  
  if (Math.abs(highest - recentHigh) < highest * 0.003 && currentPrice < highest) {
    return {
      name: "DOUBLE TOP",
      type: "bearish",
      strength: 8,
      description: "Double top pattern detected. Strong bearish reversal signal.",
    };
  }
  return null;
}

function detectDoubleBottom(lows: number[], currentPrice: number): ChartPattern | null {
  if (lows.length < 10) return null;
  
  const lowest = Math.min(...lows.slice(0, -3));
  const recentLow = Math.min(...lows.slice(-3));
  
  if (Math.abs(lowest - recentLow) < lowest * 0.003 && currentPrice > lowest) {
    return {
      name: "DOUBLE BOTTOM",
      type: "bullish",
      strength: 8,
      description: "Double bottom pattern detected. Strong bullish reversal signal.",
    };
  }
  return null;
}

function detectHeadAndShoulders(highs: number[], currentPrice: number): ChartPattern | null {
  if (highs.length < 15) return null;
  
  const leftShoulder = Math.max(...highs.slice(0, 5));
  const head = Math.max(...highs.slice(5, 10));
  const rightShoulder = Math.max(...highs.slice(10, 15));
  
  if (head > leftShoulder && head > rightShoulder && 
      Math.abs(leftShoulder - rightShoulder) < head * 0.01 &&
      currentPrice < rightShoulder) {
    return {
      name: "HEAD AND SHOULDERS",
      type: "bearish",
      strength: 10,
      description: "Head and shoulders pattern detected. Major bearish reversal.",
    };
  }
  return null;
}

function detectAscendingTriangle(highs: number[], lows: number[]): ChartPattern | null {
  const flatTop = Math.abs(Math.max(...highs.slice(-5)) - Math.max(...highs.slice(-10))) < highs[highs.length - 1] * 0.003;
  const risingBottom = lows[lows.length - 1] > lows[lows.length - 5];
  
  if (flatTop && risingBottom) {
    return {
      name: "ASCENDING TRIANGLE",
      type: "bullish",
      strength: 7,
      description: "Ascending triangle. Bullish continuation pattern.",
    };
  }
  return null;
}

function detectDescendingTriangle(highs: number[], lows: number[]): ChartPattern | null {
  const flatBottom = Math.abs(Math.min(...lows.slice(-5)) - Math.min(...lows.slice(-10))) < lows[lows.length - 1] * 0.003;
  const fallingTop = highs[highs.length - 1] < highs[highs.length - 5];
  
  if (flatBottom && fallingTop) {
    return {
      name: "DESCENDING TRIANGLE",
      type: "bearish",
      strength: 7,
      description: "Descending triangle. Bearish continuation pattern.",
    };
  }
  return null;
}

function detectBullFlag(prices: number[]): ChartPattern | null {
  const flagpole = prices[5] - prices[0];
  const flagRange = Math.max(...prices.slice(5)) - Math.min(...prices.slice(5));
  
  if (flagpole > flagRange * 2 && prices[prices.length - 1] > prices[5]) {
    return {
      name: "BULLISH FLAG",
      type: "bullish",
      strength: 6,
      description: "Bullish flag pattern. Continuation of uptrend expected.",
    };
  }
  return null;
}

function detectBearFlag(prices: number[]): ChartPattern | null {
  const flagpole = prices[0] - prices[5];
  const flagRange = Math.max(...prices.slice(5)) - Math.min(...prices.slice(5));
  
  if (flagpole > flagRange * 2 && prices[prices.length - 1] < prices[5]) {
    return {
      name: "BEARISH FLAG",
      type: "bearish",
      strength: 6,
      description: "Bearish flag pattern. Continuation of downtrend expected.",
    };
  }
  return null;
}

// ===== COMBINED ANALYSIS =====

export function analyzeAllPatterns(
  prices: number[],
  highs: number[],
  lows: number[],
): { chartPatterns: ChartPattern[]; supplyDemandZones: SupplyDemandZone[] } {
  const chartPatterns = detectChartPatterns(prices, highs, lows);
  const supplyDemandZones = findSupplyDemandZones(prices, highs, lows);
  
  return { chartPatterns, supplyDemandZones };
}