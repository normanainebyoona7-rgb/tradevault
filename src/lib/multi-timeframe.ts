// src/lib/multi-timeframe.ts

import { getRealHistoricalData } from "./forex-data";

export interface TimeframeAnalysis {
  timeframe: string;
  trend: string;
  rsi: number;
  support: number;
  resistance: number;
  direction: "long" | "short" | "neutral";
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / slice.length;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  if (gains === 0) return 0;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export async function analyzeMultipleTimeframes(pair: string): Promise<TimeframeAnalysis[]> {
  const timeframes = [
    { label: "1H", interval: "1h" },
    { label: "4H", interval: "4h" },
    { label: "1D", interval: "1d" },
  ];

  const results: TimeframeAnalysis[] = [];

  for (const tf of timeframes) {
    try {
      const prices = await getRealHistoricalData(pair, tf.interval);
      
      if (prices.length > 30) {
        const ma20 = calculateSMA(prices, 20);
        const ma50 = calculateSMA(prices, 50);
        const rsi = calculateRSI(prices);
        const currentPrice = prices[prices.length - 1];
        
        let trend = "NEUTRAL";
        if (ma20 > ma50) trend = "UPTREND";
        else if (ma20 < ma50) trend = "DOWNTREND";
        
        let direction: "long" | "short" | "neutral" = "neutral";
        if (trend === "UPTREND" && rsi < 70) direction = "long";
        else if (trend === "DOWNTREND" && rsi > 30) direction = "short";
        
        // Find support/resistance from recent data
        const recent = prices.slice(-50);
        const support = Math.min(...recent);
        const resistance = Math.max(...recent);
        
        results.push({
          timeframe: tf.label,
          trend,
          rsi: Number(rsi.toFixed(2)),
          support: Number(support.toFixed(5)),
          resistance: Number(resistance.toFixed(5)),
          direction,
        });
      }
    } catch (error) {
      console.error(`Failed to analyze ${tf.label} timeframe:`, error);
    }
  }

  return results;
}

export function getMultiTimeframeConsensus(analyses: TimeframeAnalysis[]): {
  consensus: "long" | "short" | "neutral";
  strength: number;
  alignedTimeframes: number;
  totalTimeframes: number;
} {
  if (analyses.length === 0) {
    return { consensus: "neutral", strength: 0, alignedTimeframes: 0, totalTimeframes: 0 };
  }

  let longCount = 0;
  let shortCount = 0;

  for (const analysis of analyses) {
    if (analysis.direction === "long") longCount++;
    else if (analysis.direction === "short") shortCount++;
  }

  const total = analyses.length;
  let consensus: "long" | "short" | "neutral" = "neutral";
  let alignedTimeframes = 0;

  if (longCount > shortCount) {
    consensus = "long";
    alignedTimeframes = longCount;
  } else if (shortCount > longCount) {
    consensus = "short";
    alignedTimeframes = shortCount;
  }

  const strength = (alignedTimeframes / total) * 100;

  return {
    consensus,
    strength: Number(strength.toFixed(1)),
    alignedTimeframes,
    totalTimeframes: total,
  };
}