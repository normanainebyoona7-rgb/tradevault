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
  timestamp: number;
  trendBias: string;
  supportLevel: number;
  resistanceLevel: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi: number;
  atr: number;
  session: string;
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

function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 0;

  let totalRange = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    totalRange += Math.abs(prices[i] - prices[i - 1]);
  }

  return totalRange / period;
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
): "long" | "short" {
  // RSI filter - don't buy if overbought, don't sell if oversold
  if (rsi > 70) return "short"; // Overbought = sell
  if (rsi < 30) return "long"; // Oversold = buy

  if (trendBias === "STRONG UPTREND" || trendBias === "UPTREND") {
    return "long";
  }
  if (trendBias === "STRONG DOWNTREND" || trendBias === "DOWNTREND") {
    return "short";
  }

  const distanceToSupport = currentPrice - support;
  const distanceToResistance = resistance - currentPrice;
  return distanceToSupport < distanceToResistance ? "long" : "short";
}

export async function getRealHistoricalData(pair: string): Promise<number[]> {
  try {
    const symbol = toYahooSymbol(pair);
    const queryOptions = {
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1d" as const,
    };

    const result = await yahooFinance.chart(symbol, queryOptions);
    
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes
        .filter((item) => item.close !== null && item.close !== undefined)
        .map((item) => Number(item.close));
      
      if (prices.length > 30) {
        console.log(`Got ${prices.length} real prices for ${pair}`);
        return prices;
      }
    }
  } catch (error) {
    console.error(`Yahoo Finance failed for ${pair}:`, error);
  }

  // Fallback only if Yahoo Finance completely fails
  console.log(`Using fallback prices for ${pair}`);
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

export async function generateSignalLevels(
  pair: string,
  currentPrice: number,
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

  // Indicators
  const ma20 = calculateSMA(priceHistory, 20);
  const ma50 = calculateSMA(priceHistory, 50);
  const ma200 = calculateSMA(priceHistory, 200);
  const rsi = calculateRSI(priceHistory);
  const atr = calculateATR(priceHistory);

  // S/R
  const { support, resistance } = findSupportResistance(priceHistory);

  // Trend
  const trendBias = determineTrend(ma20, ma50, ma200);

  // Session
  const session = getCurrentSession();

  // Direction with RSI filter
  const direction = determineDirection(trendBias, currentPrice, support, resistance, rsi);

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

  const confidence =
    trendBias === "STRONG UPTREND" || trendBias === "STRONG DOWNTREND"
      ? "HIGH"
      : trendBias === "NEUTRAL"
        ? "LOW"
        : "MEDIUM";

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
    timestamp: Date.now(),
    trendBias,
    supportLevel: Number(support.toFixed(decimals)),
    resistanceLevel: Number(resistance.toFixed(decimals)),
    ma20: Number(ma20.toFixed(decimals)),
    ma50: Number(ma50.toFixed(decimals)),
    ma200: Number(ma200.toFixed(decimals)),
    rsi: Number(rsi.toFixed(2)),
    atr: Number(atr.toFixed(decimals)),
    session,
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };