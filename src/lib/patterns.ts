// src/lib/patterns.ts

export interface CandlestickPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  strength: number; // 0-10
}

export function detectPatterns(prices: number[], highs: number[], lows: number[]): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  
  if (prices.length < 3) return patterns;

  const last = prices.length - 1;
  const body = prices[last] - prices[last - 1];
  const upperWick = highs[last] - Math.max(prices[last], prices[last - 1]);
  const lowerWick = Math.min(prices[last], prices[last - 1]) - lows[last];
  const range = highs[last] - lows[last] || 0.0001;
  const bodySize = Math.abs(body);
  const bodyRatio = bodySize / range;

  // Doji - indecision
  if (bodyRatio < 0.1) {
    patterns.push({ name: "DOJI", type: "neutral", strength: 5 });
  }

  // Hammer - bullish reversal
  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    patterns.push({ name: "HAMMER", type: "bullish", strength: 8 });
  }

  // Shooting Star - bearish reversal
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
    patterns.push({ name: "SHOOTING STAR", type: "bearish", strength: 8 });
  }

  // Bullish Engulfing
  if (prices[last] > prices[last - 1] && prices[last - 1] < prices[last - 2]) {
    if (bodySize > Math.abs(prices[last - 1] - prices[last - 2])) {
      patterns.push({ name: "BULLISH ENGULFING", type: "bullish", strength: 9 });
    }
  }

  // Bearish Engulfing
  if (prices[last] < prices[last - 1] && prices[last - 1] > prices[last - 2]) {
    if (bodySize > Math.abs(prices[last - 1] - prices[last - 2])) {
      patterns.push({ name: "BEARISH ENGULFING", type: "bearish", strength: 9 });
    }
  }

  // Three White Soldiers - strong bullish
  if (prices[last] > prices[last - 1] && prices[last - 1] > prices[last - 2]) {
    patterns.push({ name: "THREE WHITE SOLDIERS", type: "bullish", strength: 10 });
  }

  // Three Black Crows - strong bearish
  if (prices[last] < prices[last - 1] && prices[last - 1] < prices[last - 2]) {
    patterns.push({ name: "THREE BLACK CROWS", type: "bearish", strength: 10 });
  }

  // Morning Star
  if (prices[last - 2] < prices[last - 3] && prices[last] > prices[last - 2]) {
    patterns.push({ name: "MORNING STAR", type: "bullish", strength: 9 });
  }

  // Evening Star
  if (prices[last - 2] > prices[last - 3] && prices[last] < prices[last - 2]) {
    patterns.push({ name: "EVENING STAR", type: "bearish", strength: 9 });
  }

  return patterns;
}