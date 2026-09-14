// src/lib/forex-data.ts
// Strategy:
// 1. NO synthetic data — signal only from real market data
// 2. Multi-confluence: trend + MACD + RSI required, plus 1 of 3 more
// 3. Market regime: ADX > 20 required (no signals in chop)
// 4. SL placed BEYOND liquidity, TPs placed AT liquidity
// 5. Everything scales with the selected timeframe

import YahooFinance from "yahoo-finance2";
import { detectPatterns, CandlestickPattern } from "./patterns";
import { backtestStrategy, BacktestResult } from "./backtest";
import { analyzeMultipleTimeframes, getMultiTimeframeConsensus } from "./multi-timeframe";
import { determineOrderType, OrderType, getOrderTypeDescription, OrderRecommendation } from "./order-types";
import { analyzeAllPatterns, ChartPattern, SupplyDemandZone } from "./advanced-patterns";
import { analyzeLiquidity, placeSlTpWithLiquidity, candlesFromCloses, LiquidityZone } from "./liquidity";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface SignalLevels {
  pair: string;
  currentPrice: number;
  direction: "long" | "short" | "neutral";
  orderType: OrderType;
  orderTypeDescription: string;
  orderRecommendation: OrderRecommendation;
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
  confidence: string;
  confidenceScore: number;
  timestamp: number;
  trendBias: string;
  supportLevel: number;
  resistanceLevel: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi: number;
  adx: number;
  atr: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  session: string;
  sessionAnalysis: string;
  signalScore: number;
  timeframe: string;
  reasons: string[];
  confluences: string[];
  patterns: CandlestickPattern[];
  chartPatterns: ChartPattern[];
  supplyDemandZones: SupplyDemandZone[];
  liquidityZones: LiquidityZone[];
  slTpSource: string;
  slTpNotes: string[];
  backtest: BacktestResult;
  multiTimeframeConsensus: string;
  multiTimeframeStrength: number;
  dataSource: string;
}

const FALLBACK_PRICES: Record<string, number> = {
  "EUR/USD": 1.0850, "GBP/USD": 1.2700, "USD/JPY": 148.50,
  "XAU/USD": 2400.00, "XAG/USD": 28.50, "BTC/USD": 67000.00,
  "ETH/USD": 3200.00, "GBP/JPY": 188.50,
};

const EXNESS_SPREADS: Record<string, number> = {
  "EUR/USD": 1, "GBP/USD": 1.5, "USD/JPY": 1.2, "XAU/USD": 50,
  "XAG/USD": 30, "BTC/USD": 100, "ETH/USD": 20, "GBP/JPY": 2.5,
};

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD"];
const METAL_PAIRS = ["XAU/USD", "XAG/USD"];

interface TimeframeConfig {
  rsiPeriod: number;
  atrPeriod: number;
  adxPeriod: number;
  ma20: number;
  ma50: number;
  ma200: number;
  bbPeriod: number;
  bbStdDev: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  srLookback: number;
  minSlPercent: number;
  maxSlPercent: number;
  timeframeMultiplier: number; // for liquidity-based SL buffer
}

function getTimeframeConfig(timeframe: string): TimeframeConfig {
  const configs: Record<string, TimeframeConfig> = {
    "1m":  { rsiPeriod: 7,  atrPeriod: 7,  adxPeriod: 14, ma20: 10, ma50: 25, ma200: 100, bbPeriod: 10, bbStdDev: 2, macdFast: 6,  macdSlow: 13, macdSignal: 5, srLookback: 15, minSlPercent: 0.0008, maxSlPercent: 0.008, timeframeMultiplier: 0.4 },
    "5m":  { rsiPeriod: 9,  atrPeriod: 9,  adxPeriod: 14, ma20: 15, ma50: 35, ma200: 150, bbPeriod: 15, bbStdDev: 2, macdFast: 8,  macdSlow: 17, macdSignal: 6, srLookback: 20, minSlPercent: 0.0015, maxSlPercent: 0.012, timeframeMultiplier: 0.6 },
    "15m": { rsiPeriod: 11, atrPeriod: 11, adxPeriod: 14, ma20: 20, ma50: 50, ma200: 150, bbPeriod: 20, bbStdDev: 2, macdFast: 10, macdSlow: 22, macdSignal: 8, srLookback: 25, minSlPercent: 0.002,  maxSlPercent: 0.02,  timeframeMultiplier: 0.8 },
    "30m": { rsiPeriod: 12, atrPeriod: 12, adxPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, bbStdDev: 2, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 30, minSlPercent: 0.0025, maxSlPercent: 0.025, timeframeMultiplier: 0.9 },
    "1H":  { rsiPeriod: 14, atrPeriod: 14, adxPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, bbStdDev: 2, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 50, minSlPercent: 0.003,  maxSlPercent: 0.03,  timeframeMultiplier: 1.0 },
    "4H":  { rsiPeriod: 14, atrPeriod: 14, adxPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, bbStdDev: 2, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 50, minSlPercent: 0.005,  maxSlPercent: 0.05,  timeframeMultiplier: 1.2 },
    "1D":  { rsiPeriod: 14, atrPeriod: 14, adxPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, bbStdDev: 2, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 30, minSlPercent: 0.01,   maxSlPercent: 0.08,  timeframeMultiplier: 1.5 },
    "1W":  { rsiPeriod: 14, atrPeriod: 14, adxPeriod: 14, ma20: 10, ma50: 30, ma200: 100, bbPeriod: 20, bbStdDev: 2, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 20, minSlPercent: 0.02,   maxSlPercent: 0.12,  timeframeMultiplier: 2.0 },
  };
  return configs[timeframe] || configs["1H"];
}

function toYahooSymbol(pair: string): string {
  const symbols: Record<string, string> = {
    "EUR/USD": "EURUSD=X", "GBP/USD": "GBPUSD=X", "USD/JPY": "JPY=X",
    "XAU/USD": "GC=F", "XAG/USD": "SI=F", "BTC/USD": "BTC-USD",
    "ETH/USD": "ETH-USD", "GBP/JPY": "GBPJPY=X",
  };
  return symbols[pair] || "EURUSD=X";
}

function timeframeToYahooInterval(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1wk",
  };
  return map[timeframe] || "1h";
}

export function calculatePipSize(pair: string): number {
  const [, quote] = pair.split("/");
  if (pair.includes("XAU")) return 0.10;
  if (pair.includes("XAG")) return 0.01;
  if (pair.includes("BTC")) return 1.00;
  if (pair.includes("ETH")) return 0.10;
  if (quote === "JPY") return 0.01;
  return 0.0001;
}

export function getExnessSpread(pair: string): number {
  return EXNESS_SPREADS[pair] || 2;
}

// ===== INDICATORS =====

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / slice.length;
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  const sma = calculateSMA(prices.slice(0, period), period);
  ema.push(sma);
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }
  return ema;
}

function calculateRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  if (gains === 0) return 0;
  return 100 - 100 / (1 + gains / losses);
}

function calculateATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return 0;
  let totalRange = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    totalRange += Math.abs(prices[i] - prices[i - 1]);
  }
  return totalRange / period;
}

// ADX: trend strength. > 25 = strong trend, < 20 = ranging/chop
function calculateADX(prices: number[], period: number = 14): number {
  if (prices.length < period * 2) return 0;

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const high = Math.max(prices[i], prices[i - 1]);
    const low = Math.min(prices[i], prices[i - 1]);
    const prevHigh = Math.max(prices[i - 1], prices[i - 2] || prices[i - 1]);
    const prevLow = Math.min(prices[i - 1], prices[i - 2] || prices[i - 1]);
    const prevClose = prices[i - 1];

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    trueRanges.push(tr);
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trueRanges.length < period) return 0;

  const recentTR = trueRanges.slice(-period).reduce((s, v) => s + v, 0);
  const recentPlusDM = plusDM.slice(-period).reduce((s, v) => s + v, 0);
  const recentMinusDM = minusDM.slice(-period).reduce((s, v) => s + v, 0);

  if (recentTR === 0) return 0;

  const plusDI = (recentPlusDM / recentTR) * 100;
  const minusDI = (recentMinusDM / recentTR) * 100;
  const sumDI = plusDI + minusDI;

  if (sumDI === 0) return 0;

  const dx = (Math.abs(plusDI - minusDI) / sumDI) * 100;
  return dx;
}

function calculateMACD(prices: number[], fast: number, slow: number, signalPeriod: number) {
  if (prices.length < slow + signalPeriod) return { macd: 0, signal: 0, histogram: 0 };
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  const macdLine = emaFast[emaFast.length - 1] - emaSlow[emaSlow.length - 1];
  const macdValues: number[] = [];
  for (let i = 0; i < emaFast.length; i++) macdValues.push(emaFast[i] - emaSlow[i]);
  const signalEMA = calculateEMA(macdValues, signalPeriod);
  const signalLine = signalEMA[signalEMA.length - 1];
  return {
    macd: Number(macdLine.toFixed(5)),
    signal: Number(signalLine.toFixed(5)),
    histogram: Number((macdLine - signalLine).toFixed(5)),
  };
}

function calculateBollingerBands(prices: number[], period: number, stdDevMultiplier: number) {
  if (prices.length < period) {
    const middle = calculateSMA(prices, prices.length);
    return { upper: middle, middle, lower: middle };
  }
  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.map(p => Math.pow(p - middle, 2)).reduce((s, v) => s + v, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: Number((middle + stdDevMultiplier * stdDev).toFixed(5)),
    middle: Number(middle.toFixed(5)),
    lower: Number((middle - stdDevMultiplier * stdDev).toFixed(5)),
  };
}

function findSupportResistance(prices: number[], lookback: number) {
  if (prices.length === 0) return { support: 0, resistance: 0 };
  const recent = prices.slice(-lookback);
  const swings: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i+1] && recent[i] < recent[i+2]) swings.push(recent[i]);
    if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i+1] && recent[i] > recent[i+2]) swings.push(recent[i]);
  }
  if (swings.length === 0) return { support: Math.min(...recent), resistance: Math.max(...recent) };
  const lastPrice = recent[recent.length - 1];
  const supports = swings.filter(s => s < lastPrice);
  const resistances = swings.filter(r => r > lastPrice);
  return {
    support: supports.length > 0 ? Math.max(...supports) : Math.min(...recent),
    resistance: resistances.length > 0 ? Math.min(...resistances) : Math.max(...recent),
  };
}

function determineTrend(ma20: number, ma50: number, ma200: number): string {
  if (ma20 > ma50 && ma50 > ma200) return "STRONG UPTREND";
  if (ma20 > ma50) return "UPTREND";
  if (ma20 < ma50 && ma50 < ma200) return "STRONG DOWNTREND";
  if (ma20 < ma50) return "DOWNTREND";
  return "NEUTRAL";
}

function getCurrentSession(): string {
  const hour = new Date().getHours();
  if (hour >= 8 && hour <= 16) return "LONDON";
  if (hour >= 13 && hour <= 21) return "NEW YORK";
  if (hour >= 0 && hour <= 8) return "ASIAN";
  return "OTHER";
}

function getSessionAnalysis(session: string, pair: string): string {
  const map: Record<string, string> = {
    "LONDON": `London session. High liquidity for ${pair}.`,
    "NEW YORK": `New York session. USD volatility.`,
    "ASIAN": `Asian session. Lower volatility.`,
    "OTHER": `Off-peak hours.`,
  };
  return map[session] || map["OTHER"];
}

// ===== MULTI-CONFLUENCE DIRECTION DECISION =====

interface DirectionDecision {
  direction: "long" | "short" | "neutral";
  score: number;
  reasons: string[];
  confluences: string[];
}

function decideDirection(
  trendBias: string,
  lastClose: number,
  support: number,
  resistance: number,
  rsi: number,
  macdHistogram: number,
  bollingerUpper: number,
  bollingerLower: number,
  chartPatterns: ChartPattern[],
  adx: number,
): DirectionDecision {
  const reasons: string[] = [];
  const confluences: string[] = [];

  // ==== HARD RULE 1: No trade in ranging markets ====
  if (adx < 20) {
    return {
      direction: "neutral",
      score: 0,
      reasons: ["ADX < 20 — market is ranging"],
      confluences: [`⚠️ Ranging market (ADX ${adx.toFixed(1)})`],
    };
  }

  // ==== MANDATORY CONFLUENCES (1, 2, 3) ====

  // 1. Trend
  const trendLong = trendBias === "STRONG UPTREND" || trendBias === "UPTREND";
  const trendShort = trendBias === "STRONG DOWNTREND" || trendBias === "DOWNTREND";

  if (!trendLong && !trendShort) {
    return {
      direction: "neutral",
      score: 0,
      reasons: ["No clear trend"],
      confluences: [`⚠️ Trend: ${trendBias}`],
    };
  }

  const direction: "long" | "short" = trendLong ? "long" : "short";
  let score = 0;

  // Trend confirmation
  if (trendBias === "STRONG UPTREND" || trendBias === "STRONG DOWNTREND") {
    score += 25;
    confluences.push(`✅ Strong trend: ${trendBias}`);
  } else {
    score += 15;
    confluences.push(`✅ Trend: ${trendBias}`);
  }

  // 2. MACD must confirm
  if ((direction === "long" && macdHistogram > 0) || (direction === "short" && macdHistogram < 0)) {
    score += 15;
    confluences.push(`✅ MACD confirms (${macdHistogram > 0 ? "bullish" : "bearish"})`);
  } else {
    return {
      direction: "neutral",
      score: 0,
      reasons: ["MACD does not confirm trend direction"],
      confluences: [`⚠️ MACD disagrees with trend`],
    };
  }

  // 3. RSI in healthy zone
  if (direction === "long") {
    if (rsi >= 35 && rsi <= 65) {
      score += 15;
      confluences.push(`✅ RSI healthy (${rsi.toFixed(1)})`);
    } else if (rsi < 30) {
      return {
        direction: "neutral",
        score: 0,
        reasons: ["RSI oversold — potential reversal against long"],
        confluences: [`⚠️ RSI ${rsi.toFixed(1)} too low`],
      };
    } else if (rsi > 75) {
      return {
        direction: "neutral",
        score: 0,
        reasons: ["RSI overbought — poor entry for long"],
        confluences: [`⚠️ RSI ${rsi.toFixed(1)} too high`],
      };
    } else {
      score += 5;
      confluences.push(`⚠️ RSI acceptable (${rsi.toFixed(1)})`);
    }
  } else {
    if (rsi >= 35 && rsi <= 65) {
      score += 15;
      confluences.push(`✅ RSI healthy (${rsi.toFixed(1)})`);
    } else if (rsi > 70) {
      return {
        direction: "neutral",
        score: 0,
        reasons: ["RSI overbought — potential reversal against short"],
        confluences: [`⚠️ RSI ${rsi.toFixed(1)} too high`],
      };
    } else if (rsi < 25) {
      return {
        direction: "neutral",
        score: 0,
        reasons: ["RSI oversold — poor entry for short"],
        confluences: [`⚠️ RSI ${rsi.toFixed(1)} too low`],
      };
    } else {
      score += 5;
      confluences.push(`⚠️ RSI acceptable (${rsi.toFixed(1)})`);
    }
  }

  // ==== OPTIONAL CONFLUENCES (need at least 1) ====
  let optionalCount = 0;

  // 4. Bollinger — price at extreme for reversal
  if (direction === "long" && lastClose <= bollingerLower) {
    score += 10;
    optionalCount++;
    confluences.push("✅ Price at lower Bollinger");
  } else if (direction === "short" && lastClose >= bollingerUpper) {
    score += 10;
    optionalCount++;
    confluences.push("✅ Price at upper Bollinger");
  }

  // 5. S/R proximity
  const distanceToSupport = Math.abs(lastClose - support);
  const distanceToResistance = Math.abs(resistance - lastClose);
  const totalRange = distanceToSupport + distanceToResistance || 1;
  const supportRatio = distanceToSupport / totalRange;

  if (direction === "long" && supportRatio < 0.35) {
    score += 10;
    optionalCount++;
    confluences.push("✅ Near support");
  } else if (direction === "short" && supportRatio > 0.65) {
    score += 10;
    optionalCount++;
    confluences.push("✅ Near resistance");
  }

  // 6. Chart patterns matching direction
  const matchingPatterns = chartPatterns.filter(p =>
    (direction === "long" && p.type === "bullish") ||
    (direction === "short" && p.type === "bearish")
  );
  if (matchingPatterns.length > 0) {
    score += Math.min(matchingPatterns.length * 5, 15);
    optionalCount++;
    matchingPatterns.forEach(p => confluences.push(`📐 ${p.name} (${p.type})`));
  }

  // ==== FINAL: Require at least 1 optional confluence ====
  if (optionalCount === 0) {
    return {
      direction: "neutral",
      score: 0,
      reasons: ["No optional confluence — base conditions met but setup weak"],
      confluences: [...confluences, "⚠️ Only base conditions met"],
    };
  }

  // ADX bonus
  if (adx > 30) {
    score += 10;
    confluences.push(`✅ Strong trend (ADX ${adx.toFixed(1)})`);
  } else {
    confluences.push(`ADX: ${adx.toFixed(1)}`);
  }

  // Final threshold
  if (score < 55) {
    return {
      direction: "neutral",
      score,
      reasons: [`Score ${score} below minimum 55`],
      confluences,
    };
  }

  return { direction, score: Math.min(score, 100), reasons, confluences };
}

// ===== DATA FETCHING (NO SYNTHETIC) =====

function shouldUseYahoo(pair: string, timeframe: string): boolean {
  if (CRYPTO_PAIRS.includes(pair)) return ["1H", "4H", "1D", "1W"].includes(timeframe);
  if (METAL_PAIRS.includes(pair)) return true;
  return false;
}

async function fetchFromFCS(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const url = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const r = await fetch(`${url}/api/get-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 200 }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.closes && d.closes.length >= 100) {
        console.log(`[FCS] ${pair} ${timeframe}: ${d.closes.length} candles`);
        return d.closes;
      }
    }
  } catch (e: any) {
    console.error(`FCS failed ${pair}: ${e?.message}`);
  }
  return null;
}

async function fetchFromYahoo(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const symbol = toYahooSymbol(pair);
    const interval = timeframeToYahooInterval(timeframe);
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: interval as any,
    });
    if (result.quotes && result.quotes.length >= 100) {
      const prices = result.quotes.filter(q => q.close != null).map(q => Number(q.close));
      if (prices.length >= 100) {
        console.log(`[Yahoo] ${pair} ${timeframe}: ${prices.length} candles`);
        return prices;
      }
    }
  } catch (e: any) {
    console.error(`Yahoo failed ${pair}: ${e?.message}`);
  }
  return null;
}

export async function getRealHistoricalData(pair: string, interval: string = "1H"): Promise<{ prices: number[]; source: string } | null> {
  const useYahoo = shouldUseYahoo(pair, interval);

  let data: number[] | null = null;
  let source = "";

  if (useYahoo) {
    data = await fetchFromYahoo(pair, interval);
    if (data) source = "yahoo";
    else {
      data = await fetchFromFCS(pair, interval);
      if (data) source = "fcs";
    }
  } else {
    data = await fetchFromFCS(pair, interval);
    if (data) source = "fcs";
    else {
      data = await fetchFromYahoo(pair, interval);
      if (data) source = "yahoo";
    }
  }

  if (!data) return null;
  return { prices: data, source };
}

export async function getLivePrice(pair: string, timeframe: string = "1H"): Promise<number> {
  const data = await getRealHistoricalData(pair, timeframe);
  if (data && data.prices.length > 0) {
    return data.prices[data.prices.length - 1];
  }
  // If we can't get real data, return 0 to signal failure
  return 0;
}

// ===== MAIN SIGNAL GENERATION =====

export async function generateSignalLevels(
  pair: string,
  currentPrice: number,
  timeframe: string = "1H",
): Promise<SignalLevels> {
  const config = getTimeframeConfig(timeframe);
  const pipSize = calculatePipSize(pair);
  const spread = getExnessSpread(pair);
  const [, quote] = pair.split("/");

  let decimals = 5;
  if (quote === "JPY") decimals = 3;
  if (pair.includes("XAU")) decimals = 2;
  if (pair.includes("XAG")) decimals = 3;
  if (pair.includes("BTC")) decimals = 2;
  if (pair.includes("ETH")) decimals = 2;

  // ==== Get real data — no synthetic fallback ====
  const dataResult = await getRealHistoricalData(pair, timeframe);

  if (!dataResult) {
    // Return neutral — no fake data allowed
    const neutral: SignalLevels = {
      pair,
      currentPrice,
      direction: "neutral",
      orderType: "MARKET_BUY",
      orderTypeDescription: "No trade",
      orderRecommendation: { orderType: "MARKET_BUY", entryPrice: currentPrice, reason: "No data", confidence: 0 },
      entry: currentPrice,
      stopLoss: 0, takeProfit1: 0, takeProfit2: 0, takeProfit3: 0,
      riskPips: 0, rewardPips1: 0, rewardPips2: 0, rewardPips3: 0,
      riskReward1: "0", riskReward2: "0", riskReward3: "0",
      confidence: "NEUTRAL",
      confidenceScore: 0,
      timestamp: Date.now(),
      trendBias: "UNKNOWN",
      supportLevel: 0, resistanceLevel: 0,
      ma20: 0, ma50: 0, ma200: 0,
      rsi: 50, adx: 0, atr: 0,
      macd: 0, macdSignal: 0, macdHistogram: 0,
      bollingerUpper: 0, bollingerMiddle: 0, bollingerLower: 0,
      session: getCurrentSession(),
      sessionAnalysis: "No data available",
      signalScore: 0,
      timeframe,
      reasons: ["No real market data available"],
      confluences: ["❌ FCS and Yahoo both failed — no signal generated"],
      patterns: [],
      chartPatterns: [],
      supplyDemandZones: [],
      liquidityZones: [],
      slTpSource: "none",
      slTpNotes: [],
      backtest: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, averageWin: 0, averageLoss: 0, profitFactor: 0, maxDrawdown: 0, bestTrade: 0, worstTrade: 0, averageRR: 0 },
      multiTimeframeConsensus: "unknown",
      multiTimeframeStrength: 0,
      dataSource: "none",
    };
    console.log(`[Signal] ${pair} ${timeframe}: NEUTRAL — no real data`);
    return neutral;
  }

  const { prices: priceHistory, source: dataSource } = dataResult;

  // If currentPrice is 0 (came from getLivePrice failure), use last close
  if (currentPrice <= 0) currentPrice = priceHistory[priceHistory.length - 1];

  const lastClose = priceHistory[priceHistory.length - 1];

  const highs = priceHistory.map((p, i) => Math.max(p, priceHistory[i - 1] || p) * 1.0005);
  const lows = priceHistory.map((p, i) => Math.min(p, priceHistory[i - 1] || p) * 0.9995);

  const ma20 = calculateSMA(priceHistory, config.ma20);
  const ma50 = calculateSMA(priceHistory, config.ma50);
  const ma200 = calculateSMA(priceHistory, config.ma200);
  const rsi = calculateRSI(priceHistory, config.rsiPeriod);
  const atr = calculateATR(priceHistory, config.atrPeriod);
  const adx = calculateADX(priceHistory, config.adxPeriod);
  const macdData = calculateMACD(priceHistory, config.macdFast, config.macdSlow, config.macdSignal);
  const bollinger = calculateBollingerBands(priceHistory, config.bbPeriod, config.bbStdDev);

  const { support, resistance } = findSupportResistance(priceHistory, config.srLookback);
  const trendBias = determineTrend(ma20, ma50, ma200);
  const session = getCurrentSession();
  const sessionAnalysis = getSessionAnalysis(session, pair);

  const { chartPatterns, supplyDemandZones } = analyzeAllPatterns(priceHistory, highs, lows);

  // Liquidity analysis for SL/TP placement
  const candles = candlesFromCloses(priceHistory);
  const liquidity = analyzeLiquidity(candles);

  // Direction decision with all confluence checks
  const decision = decideDirection(
    trendBias, lastClose, support, resistance, rsi,
    macdData.histogram, bollinger.upper, bollinger.lower,
    chartPatterns, adx
  );

  const direction = decision.direction;
  const score = decision.score;
  const confluences = decision.confluences;

  // ==== SL / TP PLACEMENT USING LIQUIDITY ====
  const entry = currentPrice;
  let stopLoss = entry, tp1 = entry, tp2 = entry, tp3 = entry;
  let slTpSource = "none";
  let slTpNotes: string[] = [];

  if (direction !== "neutral") {
    const plan = placeSlTpWithLiquidity(
      direction,
      entry,
      liquidity,
      config.timeframeMultiplier,
      config.minSlPercent,
      config.maxSlPercent,
      pipSize,
    );
    stopLoss = plan.stopLoss;
    tp1 = plan.takeProfit1;
    tp2 = plan.takeProfit2;
    tp3 = plan.takeProfit3;
    slTpSource = plan.source;
    slTpNotes = plan.notes;

    confluences.push(`🎯 SL/TP source: ${slTpSource}`);
    slTpNotes.forEach(n => confluences.push(`  • ${n}`));
  }

  const riskPips = Math.round(Math.abs(entry - stopLoss) / pipSize);
  const rewardPips1 = Math.round(Math.abs(tp1 - entry) / pipSize);
  const rewardPips2 = Math.round(Math.abs(tp2 - entry) / pipSize);
  const rewardPips3 = Math.round(Math.abs(tp3 - entry) / pipSize);

  const riskReward1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const riskReward2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const riskReward3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  // Reject if R:R < 1.2 for TP1
  let finalDirection = direction;
  if (direction !== "neutral" && parseFloat(riskReward1) < 1.2) {
    finalDirection = "neutral";
    confluences.push("❌ Rejected: TP1 R:R < 1.2");
  }

  const confidence = finalDirection === "neutral" ? "NEUTRAL" : score >= 70 ? "HIGH" : "MEDIUM";

  console.log(`[Signal] ${pair} ${timeframe}: dir=${finalDirection} score=${score} adx=${adx.toFixed(1)} rsi=${rsi.toFixed(1)} entry=${entry.toFixed(4)} sl=${stopLoss.toFixed(4)} tp1=${tp1.toFixed(4)} rr1=${riskReward1} src=${dataSource} sltp=${slTpSource}`);

  const patterns = detectPatterns(priceHistory, highs, lows);
  const backtest = backtestStrategy(
    priceHistory,
    finalDirection === "neutral" ? "long" : finalDirection,
    riskPips || 10,
    rewardPips1 || 15,
    pipSize,
  );
  const timeframeAnalyses = await analyzeMultipleTimeframes(pair);
  const mtfConsensus = getMultiTimeframeConsensus(timeframeAnalyses);

  const orderRecommendation = determineOrderType(
    finalDirection === "neutral" ? "long" : finalDirection,
    entry, support, resistance, rsi, bollinger.upper, bollinger.lower, trendBias, atr
  );

  return {
    pair,
    currentPrice: Number(currentPrice.toFixed(decimals)),
    direction: finalDirection,
    orderType: orderRecommendation.orderType,
    orderTypeDescription: getOrderTypeDescription(orderRecommendation.orderType),
    orderRecommendation,
    entry: Number(entry.toFixed(decimals)),
    stopLoss: Number(stopLoss.toFixed(decimals)),
    takeProfit1: Number(tp1.toFixed(decimals)),
    takeProfit2: Number(tp2.toFixed(decimals)),
    takeProfit3: Number(tp3.toFixed(decimals)),
    riskPips,
    rewardPips1, rewardPips2, rewardPips3,
    riskReward1,
    riskReward2,
    riskReward3,
    confidence,
    confidenceScore: finalDirection === "neutral" ? 0 : score,
    timestamp: Date.now(),
    trendBias,
    supportLevel: Number(support.toFixed(decimals)),
    resistanceLevel: Number(resistance.toFixed(decimals)),
    ma20: Number(ma20.toFixed(decimals)),
    ma50: Number(ma50.toFixed(decimals)),
    ma200: Number(ma200.toFixed(decimals)),
    rsi: Number(rsi.toFixed(2)),
    adx: Number(adx.toFixed(2)),
    atr: Number(atr.toFixed(decimals)),
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower,
    session,
    sessionAnalysis,
    signalScore: score,
    timeframe,
    reasons: decision.reasons,
    confluences,
    patterns,
    chartPatterns,
    supplyDemandZones,
    liquidityZones: liquidity.zones,
    slTpSource,
    slTpNotes,
    backtest,
    multiTimeframeConsensus: mtfConsensus.consensus,
    multiTimeframeStrength: mtfConsensus.strength,
    dataSource,
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };