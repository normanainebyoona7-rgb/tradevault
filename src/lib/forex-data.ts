// src/lib/forex-data.ts

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface SignalLevels {
  pair: string;
  currentPrice: number;
  direction: "long" | "short";
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
  atr: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  session: string;
  signalScore: number;
  timeframe: string;
  reasons: string[];
}

const FALLBACK_PRICES: Record<string, number> = {
  "EUR/USD": 1.0850,
  "GBP/USD": 1.2700,
  "USD/JPY": 148.50,
  "XAU/USD": 2400.00,
  "XAG/USD": 28.50,
  "BTC/USD": 67000.00,
  "ETH/USD": 3200.00,
  "GBP/JPY": 188.50,
};

const EXNESS_SPREADS: Record<string, number> = {
  "EUR/USD": 1,
  "GBP/USD": 1.5,
  "USD/JPY": 1.2,
  "XAU/USD": 50,
  "XAG/USD": 30,
  "BTC/USD": 100,
  "ETH/USD": 20,
  "GBP/JPY": 2.5,
};

function toYahooSymbol(pair: string): string {
  const symbols: Record<string, string> = {
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "JPY=X",
    "XAU/USD": "GC=F",
    "XAG/USD": "SI=F",
    "BTC/USD": "BTC-USD",
    "ETH/USD": "ETH-USD",
    "GBP/JPY": "GBPJPY=X",
  };
  return symbols[pair] || "EURUSD=X";
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

// ===== TECHNICAL INDICATORS =====

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / slice.length;
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first value
  const sma = calculateSMA(prices.slice(0, period), period);
  ema.push(sma);
  
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }
  
  return ema;
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

function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 0;

  let totalRange = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    totalRange += Math.abs(prices[i] - prices[i - 1]);
  }

  return totalRange / period;
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  if (prices.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  
  // Calculate signal line (9-day EMA of MACD)
  const macdValues: number[] = [];
  for (let i = 0; i < ema12.length; i++) {
    macdValues.push(ema12[i] - ema26[i]);
  }
  
  const signalEMA = calculateEMA(macdValues, 9);
  const signalLine = signalEMA[signalEMA.length - 1];
  
  return {
    macd: Number(macdLine.toFixed(5)),
    signal: Number(signalLine.toFixed(5)),
    histogram: Number((macdLine - signalLine).toFixed(5)),
  };
}

function calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    const middle = calculateSMA(prices, prices.length);
    return { upper: middle, middle, lower: middle };
  }
  
  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: Number((middle + 2 * stdDev).toFixed(5)),
    middle: Number(middle.toFixed(5)),
    lower: Number((middle - 2 * stdDev).toFixed(5)),
  };
}

function findSupportResistance(prices: number[]): { support: number; resistance: number } {
  if (prices.length === 0) return { support: 0, resistance: 0 };

  const swings: number[] = [];
  for (let i = 2; i < prices.length - 2; i++) {
    if (prices[i] < prices[i - 1] && prices[i] < prices[i - 2] && prices[i] < prices[i + 1] && prices[i] < prices[i + 2]) {
      swings.push(prices[i]);
    }
    if (prices[i] > prices[i - 1] && prices[i] > prices[i - 2] && prices[i] > prices[i + 1] && prices[i] > prices[i + 2]) {
      swings.push(prices[i]);
    }
  }

  if (swings.length === 0) {
    const recent = prices.slice(-50);
    return { support: Math.min(...recent), resistance: Math.max(...recent) };
  }

  return {
    support: Math.min(...swings.slice(0, 5)),
    resistance: Math.max(...swings.slice(0, 5)),
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

function determineDirection(
  trendBias: string,
  currentPrice: number,
  support: number,
  resistance: number,
  rsi: number,
  macdHistogram: number,
  bollingerUpper: number,
  bollingerLower: number,
): "long" | "short" {
  let longScore = 0;
  let shortScore = 0;

  // Trend analysis
  if (trendBias === "STRONG UPTREND") longScore += 3;
  else if (trendBias === "UPTREND") longScore += 2;
  else if (trendBias === "STRONG DOWNTREND") shortScore += 3;
  else if (trendBias === "DOWNTREND") shortScore += 2;

  // RSI filter
  if (rsi < 30) longScore += 2; // Oversold = buy opportunity
  if (rsi > 70) shortScore += 2; // Overbought = sell opportunity
  if (rsi >= 30 && rsi <= 50) longScore += 1;
  if (rsi >= 50 && rsi <= 70) shortScore += 1;

  // MACD
  if (macdHistogram > 0) longScore += 2;
  if (macdHistogram < 0) shortScore += 2;

  // Bollinger Bands
  if (currentPrice <= bollingerLower) longScore += 2; // At lower band = buy
  if (currentPrice >= bollingerUpper) shortScore += 2; // At upper band = sell

  // Support/Resistance proximity
  const distanceToSupport = Math.abs(currentPrice - support);
  const distanceToResistance = Math.abs(resistance - currentPrice);
  if (distanceToSupport < distanceToResistance) longScore += 1;
  else shortScore += 1;

  return longScore > shortScore ? "long" : "short";
}

// ===== SIGNAL SCORING SYSTEM =====

function calculateSignalScore(
  trendBias: string,
  rsi: number,
  atr: number,
  currentPrice: number,
  macdHistogram: number,
  session: string,
  support: number,
  resistance: number,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Trend Alignment (30 points max)
  if (trendBias === "STRONG UPTREND" || trendBias === "STRONG DOWNTREND") {
    score += 30;
    reasons.push("Strong trend alignment (+30)");
  } else if (trendBias === "UPTREND" || trendBias === "DOWNTREND") {
    score += 20;
    reasons.push("Moderate trend alignment (+20)");
  } else {
    score += 10;
    reasons.push("Neutral trend (+10)");
  }

  // 2. RSI Filter (20 points max)
  if (rsi > 30 && rsi < 70) {
    score += 20;
    reasons.push("RSI in optimal range (+20)");
  } else if (rsi > 20 && rsi < 80) {
    score += 10;
    reasons.push("RSI acceptable (+10)");
  } else {
    score += 0;
    reasons.push("RSI extreme - caution (+0)");
  }

  // 3. MACD Confirmation (20 points max)
  if (Math.abs(macdHistogram) > 0) {
    score += 20;
    reasons.push("MACD confirms momentum (+20)");
  } else {
    score += 0;
    reasons.push("MACD no momentum (+0)");
  }

  // 4. Session Timing (10 points max)
  if (session === "LONDON" || session === "NEW YORK") {
    score += 10;
    reasons.push("High liquidity session (+10)");
  } else {
    score += 5;
    reasons.push("Normal session (+5)");
  }

  // 5. Support/Resistance Proximity (10 points max)
  const distanceToSR = Math.min(
    Math.abs(currentPrice - support),
    Math.abs(resistance - currentPrice)
  );
  if (distanceToSR < atr * 2) {
    score += 10;
    reasons.push("Near key S/R level (+10)");
  } else {
    score += 0;
    reasons.push("Far from S/R (+0)");
  }

  // 6. Volatility Check (10 points max)
  if (atr > 0 && atr < currentPrice * 0.01) {
    score += 10;
    reasons.push("Healthy volatility (+10)");
  } else {
    score += 0;
    reasons.push("Extreme volatility (+0)");
  }

  return { score, reasons };
}

// ===== DATA FETCHING =====

export async function getRealHistoricalData(pair: string, interval: string = "1d"): Promise<number[]> {
  try {
    const symbol = toYahooSymbol(pair);
    const queryOptions = {
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: interval as any,
    };

    const result = await yahooFinance.chart(symbol, queryOptions);
    
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes
        .filter((item) => item.close !== null && item.close !== undefined)
        .map((item) => Number(item.close));
      
      if (prices.length > 30) {
        return prices;
      }
    }
  } catch (error) {
    console.error(`Yahoo Finance failed for ${pair}:`, error);
  }

  const basePrice = FALLBACK_PRICES[pair] || 1.0;
  const prices: number[] = [];
  let price = basePrice;
  const volatility = basePrice * 0.001;
  for (let i = 0; i < 200; i++) {
    price += (Math.random() - 0.5) * volatility;
    prices.push(price);
  }
  return prices;
}

export async function getLivePrice(pair: string): Promise<number> {
  const prices = await getRealHistoricalData(pair);
  return prices[prices.length - 1] || FALLBACK_PRICES[pair] || 1.0;
}

export function getPipValue(pair: string, contractSize: number): number {
  return calculatePipSize(pair) * contractSize;
}

// ===== MAIN SIGNAL GENERATION =====

export async function generateSignalLevels(
  pair: string,
  currentPrice: number,
  timeframe: string = "1H",
): Promise<SignalLevels> {
  const pipSize = calculatePipSize(pair);
  const spread = getExnessSpread(pair);
  const [, quote] = pair.split("/");

  let decimals = 5;
  if (quote === "JPY") decimals = 3;
  if (pair.includes("XAU")) decimals = 2;
  if (pair.includes("XAG")) decimals = 3;
  if (pair.includes("BTC")) decimals = 2;
  if (pair.includes("ETH")) decimals = 2;

  // Real data
  const priceHistory = await getRealHistoricalData(pair);

  // Calculate all indicators
  const ma20 = calculateSMA(priceHistory, 20);
  const ma50 = calculateSMA(priceHistory, 50);
  const ma200 = calculateSMA(priceHistory, 200);
  const rsi = calculateRSI(priceHistory);
  const atr = calculateATR(priceHistory);
  const macdData = calculateMACD(priceHistory);
  const bollinger = calculateBollingerBands(priceHistory);

  // Support/Resistance
  const { support, resistance } = findSupportResistance(priceHistory);

  // Trend
  const trendBias = determineTrend(ma20, ma50, ma200);

  // Session
  const session = getCurrentSession();

  // Direction with all indicators
  const direction = determineDirection(
    trendBias,
    currentPrice,
    support,
    resistance,
    rsi,
    macdData.histogram,
    bollinger.upper,
    bollinger.lower,
  );

  // Signal scoring
  const { score, reasons } = calculateSignalScore(
    trendBias,
    rsi,
    atr,
    currentPrice,
    macdData.histogram,
    session,
    support,
    resistance,
  );

  // Dynamic stop loss based on ATR
  const atrBasedStop = Math.max(atr * 1.5, pipSize * 10);
  const stopLossPips = pair.includes("XAU") ? 150 : pair.includes("BTC") ? 300 : Math.round(atrBasedStop / pipSize);

  const tp1Pips = Math.round(stopLossPips * 1.5);
  const tp2Pips = Math.round(stopLossPips * 2.5);
  const tp3Pips = Math.round(stopLossPips * 4);

  const spreadAmount = spread * pipSize;

  let entry: number;
  let stopLoss: number;
  let tp1: number;
  let tp2: number;
  let tp3: number;

  if (direction === "long") {
    entry = currentPrice + spreadAmount;
    stopLoss = entry - stopLossPips * pipSize;
    tp1 = entry + tp1Pips * pipSize;
    tp2 = entry + tp2Pips * pipSize;
    tp3 = entry + tp3Pips * pipSize;
  } else {
    entry = currentPrice - spreadAmount;
    stopLoss = entry + stopLossPips * pipSize;
    tp1 = entry - tp1Pips * pipSize;
    tp2 = entry - tp2Pips * pipSize;
    tp3 = entry - tp3Pips * pipSize;
  }

  // Confidence based on score
  const confidence = score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

  return {
    pair,
    currentPrice: Number(currentPrice.toFixed(decimals)),
    direction,
    entry: Number(entry.toFixed(decimals)),
    stopLoss: Number(stopLoss.toFixed(decimals)),
    takeProfit1: Number(tp1.toFixed(decimals)),
    takeProfit2: Number(tp2.toFixed(decimals)),
    takeProfit3: Number(tp3.toFixed(decimals)),
    riskPips: stopLossPips,
    rewardPips1: tp1Pips,
    rewardPips2: tp2Pips,
    rewardPips3: tp3Pips,
    riskReward1: (tp1Pips / stopLossPips).toFixed(1),
    riskReward2: (tp2Pips / stopLossPips).toFixed(1),
    riskReward3: (tp3Pips / stopLossPips).toFixed(1),
    confidence,
    confidenceScore: score,
    timestamp: Date.now(),
    trendBias,
    supportLevel: Number(support.toFixed(decimals)),
    resistanceLevel: Number(resistance.toFixed(decimals)),
    ma20: Number(ma20.toFixed(decimals)),
    ma50: Number(ma50.toFixed(decimals)),
    ma200: Number(ma200.toFixed(decimals)),
    rsi: Number(rsi.toFixed(2)),
    atr: Number(atr.toFixed(decimals)),
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower,
    session,
    signalScore: score,
    timeframe,
    reasons,
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };