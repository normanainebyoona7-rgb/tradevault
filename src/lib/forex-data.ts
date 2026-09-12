// src/lib/forex-data.ts

import YahooFinance from "yahoo-finance2";
import { detectPatterns, CandlestickPattern } from "./patterns";
import { backtestStrategy, BacktestResult } from "./backtest";
import { analyzeMultipleTimeframes, getMultiTimeframeConsensus } from "./multi-timeframe";
import { determineOrderType, OrderType, getOrderTypeDescription, OrderRecommendation } from "./order-types";
import { analyzeAllPatterns, ChartPattern, SupplyDemandZone } from "./advanced-patterns";
import { analyzeSmartMoney, OrderBlock, FairValueGap, LiquidityLevel } from "./smart-money";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface SignalLevels {
  pair: string;
  currentPrice: number;
  direction: "long" | "short";
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
  patterns: CandlestickPattern[];
  chartPatterns: ChartPattern[];
  supplyDemandZones: SupplyDemandZone[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityLevels: LiquidityLevel[];
  backtest: BacktestResult;
  multiTimeframeConsensus: string;
  multiTimeframeStrength: number;
  confluences: string[];
  dataSource: string;
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

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD"];
const METAL_PAIRS = ["XAU/USD", "XAG/USD"];

interface TimeframeConfig {
  atrMultiplier: number;
  rsiPeriod: number;
  ma20: number;
  ma50: number;
  ma200: number;
  patternLookback: number;
  minCandles: number;
  srLookback: number;
  smartMoneyLookback: number;
  bbPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  slToTpRatio: [number, number, number];
}

function getTimeframeConfig(timeframe: string): TimeframeConfig {
  const configs: Record<string, TimeframeConfig> = {
    "1m": { atrMultiplier: 1.0, rsiPeriod: 7, ma20: 10, ma50: 25, ma200: 100, patternLookback: 3, minCandles: 50, srLookback: 15, smartMoneyLookback: 10, bbPeriod: 10, macdFast: 6, macdSlow: 13, macdSignal: 5, slToTpRatio: [1.5, 3.0, 5.0] },
    "5m": { atrMultiplier: 1.0, rsiPeriod: 9, ma20: 15, ma50: 35, ma200: 150, patternLookback: 4, minCandles: 60, srLookback: 20, smartMoneyLookback: 15, bbPeriod: 15, macdFast: 8, macdSlow: 17, macdSignal: 6, slToTpRatio: [1.5, 3.0, 5.0] },
    "15m": { atrMultiplier: 1.2, rsiPeriod: 11, ma20: 20, ma50: 50, ma200: 150, patternLookback: 5, minCandles: 80, srLookback: 25, smartMoneyLookback: 20, bbPeriod: 20, macdFast: 10, macdSlow: 22, macdSignal: 8, slToTpRatio: [1.5, 3.0, 5.0] },
    "30m": { atrMultiplier: 1.2, rsiPeriod: 12, ma20: 20, ma50: 50, ma200: 200, patternLookback: 5, minCandles: 100, srLookback: 30, smartMoneyLookback: 25, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slToTpRatio: [1.5, 3.0, 5.0] },
    "1H": { atrMultiplier: 1.5, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, patternLookback: 5, minCandles: 150, srLookback: 50, smartMoneyLookback: 30, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slToTpRatio: [1.5, 3.0, 5.0] },
    "4H": { atrMultiplier: 1.8, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, patternLookback: 5, minCandles: 150, srLookback: 50, smartMoneyLookback: 30, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slToTpRatio: [2.0, 3.5, 6.0] },
    "1D": { atrMultiplier: 2.0, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, patternLookback: 5, minCandles: 150, srLookback: 30, smartMoneyLookback: 30, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slToTpRatio: [2.0, 4.0, 7.0] },
    "1W": { atrMultiplier: 2.5, rsiPeriod: 14, ma20: 10, ma50: 30, ma200: 100, patternLookback: 4, minCandles: 100, srLookback: 20, smartMoneyLookback: 20, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, slToTpRatio: [3.0, 5.0, 8.0] },
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
  const intervalMap: Record<string, string> = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1wk",
  };
  return intervalMap[timeframe] || "1h";
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

// ===== DETERMINISTIC PRNG =====

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calculateATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return 0;
  let totalRange = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    totalRange += Math.abs(prices[i] - prices[i - 1]);
  }
  return totalRange / period;
}

function calculateMACD(prices: number[], fast: number, slow: number, signalPeriod: number): { macd: number; signal: number; histogram: number } {
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

function calculateBollingerBands(prices: number[], period: number): { upper: number; middle: number; lower: number } {
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

function findSupportResistance(prices: number[], lookback: number): { support: number; resistance: number } {
  if (prices.length === 0) return { support: 0, resistance: 0 };
  const recentPrices = prices.slice(-lookback);
  const swings: number[] = [];
  for (let i = 2; i < recentPrices.length - 2; i++) {
    if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i - 2] && 
        recentPrices[i] < recentPrices[i + 1] && recentPrices[i] < recentPrices[i + 2]) {
      swings.push(recentPrices[i]);
    }
    if (recentPrices[i] > recentPrices[i - 1] && recentPrices[i] > recentPrices[i - 2] && 
        recentPrices[i] > recentPrices[i + 1] && recentPrices[i] > recentPrices[i + 2]) {
      swings.push(recentPrices[i]);
    }
  }
  if (swings.length === 0) return { support: Math.min(...recentPrices), resistance: Math.max(...recentPrices) };
  const lastPrice = recentPrices[recentPrices.length - 1];
  const supports = swings.filter(s => s < lastPrice);
  const resistances = swings.filter(r => r > lastPrice);
  return {
    support: supports.length > 0 ? Math.max(...supports) : Math.min(...recentPrices),
    resistance: resistances.length > 0 ? Math.min(...resistances) : Math.max(...recentPrices),
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
  const sessionDetails: Record<string, string> = {
    "LONDON": `London session active. High liquidity for ${pair}.`,
    "NEW YORK": `New York session active. USD volatility high.`,
    "ASIAN": `Asian session active. Lower volatility.`,
    "OTHER": `Off-peak hours. Reduced liquidity.`,
  };
  return sessionDetails[session] || sessionDetails["OTHER"];
}

// CRITICAL: Direction is determined by INDICATORS ONLY (not live price)
// This ensures user and admin see the same signal
function determineDirection(
  trendBias: string,
  lastClose: number,
  support: number,
  resistance: number,
  rsi: number,
  macdHistogram: number,
  bollingerUpper: number,
  bollingerLower: number,
  chartPatterns: ChartPattern[]
): "long" | "short" {
  let longScore = 0, shortScore = 0;
  
  if (trendBias === "STRONG UPTREND") longScore += 3;
  else if (trendBias === "UPTREND") longScore += 2;
  else if (trendBias === "STRONG DOWNTREND") shortScore += 3;
  else if (trendBias === "DOWNTREND") shortScore += 2;
  
  if (rsi < 30) longScore += 2;
  if (rsi > 70) shortScore += 2;
  if (rsi >= 30 && rsi <= 50) longScore += 1;
  if (rsi >= 50 && rsi <= 70) shortScore += 1;
  
  if (macdHistogram > 0) longScore += 2;
  if (macdHistogram < 0) shortScore += 2;
  
  if (lastClose <= bollingerLower) longScore += 2;
  if (lastClose >= bollingerUpper) shortScore += 2;
  
  const bullishPatterns = chartPatterns.filter(p => p.type === "bullish");
  const bearishPatterns = chartPatterns.filter(p => p.type === "bearish");
  if (bullishPatterns.length > 0) longScore += bullishPatterns.length * 2;
  if (bearishPatterns.length > 0) shortScore += bearishPatterns.length * 2;
  
  const distanceToSupport = Math.abs(lastClose - support);
  const distanceToResistance = Math.abs(resistance - lastClose);
  if (distanceToSupport < distanceToResistance) longScore += 1;
  else shortScore += 1;
  
  return longScore > shortScore ? "long" : "short";
}

function calculateSignalScore(trendBias: string, rsi: number, atr: number, currentPrice: number, macdHistogram: number, session: string, support: number, resistance: number, chartPatterns: ChartPattern[], supplyDemandZones: SupplyDemandZone[]): { score: number; reasons: string[]; confluences: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const confluences: string[] = [];
  if (trendBias === "STRONG UPTREND" || trendBias === "STRONG DOWNTREND") { score += 30; reasons.push("Strong trend (+30)"); confluences.push(`Trend: ${trendBias}`); }
  else if (trendBias === "UPTREND" || trendBias === "DOWNTREND") { score += 20; reasons.push("Moderate trend (+20)"); confluences.push(`Trend: ${trendBias}`); }
  else { score += 10; reasons.push("Neutral trend (+10)"); confluences.push(`Trend: ${trendBias}`); }
  if (rsi > 30 && rsi < 70) { score += 20; reasons.push("RSI optimal (+20)"); confluences.push(`RSI: ${rsi}`); }
  else if (rsi > 20 && rsi < 80) { score += 10; reasons.push("RSI acceptable (+10)"); confluences.push(`RSI: ${rsi}`); }
  else { confluences.push(`RSI: ${rsi} (extreme)`); }
  if (Math.abs(macdHistogram) > 0) { score += 20; reasons.push("MACD confirms (+20)"); confluences.push(`MACD: ${macdHistogram > 0 ? "Bullish" : "Bearish"}`); }
  if (chartPatterns.length > 0) { score += Math.min(chartPatterns.length * 5, 15); chartPatterns.forEach(p => confluences.push(`Pattern: ${p.name}`)); }
  if (supplyDemandZones.length > 0) { score += Math.min(supplyDemandZones.length * 5, 15); supplyDemandZones.forEach(z => confluences.push(`${z.type.toUpperCase()}: ${z.bottom}-${z.top}`)); }
  if (session === "LONDON" || session === "NEW YORK") { score += 10; confluences.push(`Session: ${session}`); }
  else { score += 5; confluences.push(`Session: ${session}`); }
  return { score, reasons, confluences };
}

// ===== DATA FETCHING =====

function shouldUseYahoo(pair: string, timeframe: string): boolean {
  const isCrypto = CRYPTO_PAIRS.includes(pair);
  const isMetal = METAL_PAIRS.includes(pair);
  const isHighTF = ["1H", "4H", "1D", "1W"].includes(timeframe);
  if (isCrypto) return isHighTF;
  if (isMetal) return true;
  return false;
}

async function fetchFromFCS(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/get-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 200 }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.closes && data.closes.length > 30) {
        console.log(`[FCS] ${pair} ${timeframe}: ${data.closes.length} candles`);
        return data.closes;
      }
    }
  } catch (error: any) {
    console.error(`FCS failed for ${pair} ${timeframe}:`, error?.message);
  }
  return null;
}

async function fetchFromYahoo(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const symbol = toYahooSymbol(pair);
    const yahooInterval = timeframeToYahooInterval(timeframe);
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: yahooInterval as any,
    });
    if (result.quotes && result.quotes.length > 30) {
      const prices = result.quotes
        .filter((item) => item.close !== null && item.close !== undefined)
        .map((item) => Number(item.close));
      if (prices.length > 30) {
        console.log(`[Yahoo] ${pair} ${timeframe}: ${prices.length} candles`);
        return prices;
      }
    }
  } catch (error: any) {
    console.error(`Yahoo failed for ${pair} ${timeframe}:`, error?.message);
  }
  return null;
}

export async function getRealHistoricalData(pair: string, interval: string = "1H"): Promise<{ prices: number[]; source: string }> {
  const useYahooFirst = shouldUseYahoo(pair, interval);

  if (useYahooFirst) {
    const yahooData = await fetchFromYahoo(pair, interval);
    if (yahooData) return { prices: yahooData, source: "yahoo" };
    const fcsData = await fetchFromFCS(pair, interval);
    if (fcsData) return { prices: fcsData, source: "fcs" };
  } else {
    const fcsData = await fetchFromFCS(pair, interval);
    if (fcsData) return { prices: fcsData, source: "fcs" };
    const yahooData = await fetchFromYahoo(pair, interval);
    if (yahooData) return { prices: yahooData, source: "yahoo" };
  }

  console.warn(`[Fallback] Using deterministic synthetic data for ${pair} ${interval}`);
  const basePrice = FALLBACK_PRICES[pair] || 1.0;
  const prices: number[] = [];
  let price = basePrice;
  const volatility = basePrice * 0.01;
  const seed = hashString(`${pair}-${interval}`);
  const random = mulberry32(seed);
  for (let i = 0; i < 200; i++) {
    price += (random() - 0.5) * volatility;
    prices.push(price);
  }
  return { prices, source: "synthetic_deterministic" };
}

export async function getLivePrice(pair: string, timeframe: string = "1H"): Promise<number> {
  const useYahooFirst = shouldUseYahoo(pair, timeframe);

  if (useYahooFirst) {
    try {
      const symbol = toYahooSymbol(pair);
      const yahooInterval = timeframeToYahooInterval(timeframe);
      const result = await yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: yahooInterval as any,
      });
      if (result.quotes && result.quotes.length > 0) {
        const prices = result.quotes
          .filter((q) => q.close !== null && q.close !== undefined)
          .map((q) => Number(q.close));
        if (prices.length > 0) return prices[prices.length - 1];
      }
    } catch (error) {}
  }

  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/get-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.price && data.price > 0) return data.price;
    }
  } catch (error) {}

  try {
    const symbol = toYahooSymbol(pair);
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1h",
    });
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes
        .filter((q) => q.close !== null && q.close !== undefined)
        .map((q) => Number(q.close));
      if (prices.length > 0) return prices[prices.length - 1];
    }
  } catch (error) {}

  return FALLBACK_PRICES[pair] || 1.0;
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

  const { prices: priceHistory, source: dataSource } = await getRealHistoricalData(pair, timeframe);

  // CRITICAL: Use last CLOSE from history for direction, not live tick price
  const lastClose = priceHistory[priceHistory.length - 1];

  const highs = priceHistory.map((p, i) => Math.max(p, priceHistory[i - 1] || p) * 1.001);
  const lows = priceHistory.map((p, i) => Math.min(p, priceHistory[i - 1] || p) * 0.999);

  const ma20 = calculateSMA(priceHistory, config.ma20);
  const ma50 = calculateSMA(priceHistory, config.ma50);
  const ma200 = calculateSMA(priceHistory, config.ma200);
  const rsi = calculateRSI(priceHistory, config.rsiPeriod);
  const atr = calculateATR(priceHistory, config.rsiPeriod);
  const macdData = calculateMACD(priceHistory, config.macdFast, config.macdSlow, config.macdSignal);
  const bollinger = calculateBollingerBands(priceHistory, config.bbPeriod);

  const { support, resistance } = findSupportResistance(priceHistory, config.srLookback);
  const trendBias = determineTrend(ma20, ma50, ma200);
  const session = getCurrentSession();
  const sessionAnalysis = getSessionAnalysis(session, pair);

  const { chartPatterns, supplyDemandZones } = analyzeAllPatterns(priceHistory, highs, lows);
  const { orderBlocks, fairValueGaps, liquidityLevels } = analyzeSmartMoney(priceHistory, highs, lows);

  // DIRECTION from indicators only — consistent across user and admin
  const direction = determineDirection(trendBias, lastClose, support, resistance, rsi, macdData.histogram, bollinger.upper, bollinger.lower, chartPatterns);

  const { score, reasons, confluences } = calculateSignalScore(trendBias, rsi, atr, lastClose, macdData.histogram, session, support, resistance, chartPatterns, supplyDemandZones);

  const rawAtrPips = atr / pipSize;
  const stopLossPips = Math.max(Math.round(rawAtrPips * config.atrMultiplier), 5);

  console.log(`[Signal] ${pair} ${timeframe}: source=${dataSource} candles=${priceHistory.length} lastClose=${lastClose.toFixed(4)} atr=${atr.toFixed(5)} slPips=${stopLossPips} dir=${direction}`);

  const patterns = detectPatterns(priceHistory, highs, lows);
  const backtest = backtestStrategy(priceHistory, direction, stopLossPips, Math.round(stopLossPips * config.slToTpRatio[0]), pipSize);
  const timeframeAnalyses = await analyzeMultipleTimeframes(pair);
  const mtfConsensus = getMultiTimeframeConsensus(timeframeAnalyses);

  const orderRecommendation = determineOrderType(direction, lastClose, support, resistance, rsi, bollinger.upper, bollinger.lower, trendBias, atr);

  // Entry at live price (what user sees now)
  const entry = currentPrice;
  const slDistance = stopLossPips * pipSize;
  const [tp1Ratio, tp2Ratio, tp3Ratio] = config.slToTpRatio;

  let stopLossPrice: number, tp1Price: number, tp2Price: number, tp3Price: number;

  if (direction === "long") {
    stopLossPrice = entry - slDistance;
    tp1Price = entry + slDistance * tp1Ratio;
    tp2Price = entry + slDistance * tp2Ratio;
    tp3Price = entry + slDistance * tp3Ratio;
  } else {
    stopLossPrice = entry + slDistance;
    tp1Price = entry - slDistance * tp1Ratio;
    tp2Price = entry - slDistance * tp2Ratio;
    tp3Price = entry - slDistance * tp3Ratio;
  }

  const rewardPips1 = Math.round(Math.abs(tp1Price - entry) / pipSize);
  const rewardPips2 = Math.round(Math.abs(tp2Price - entry) / pipSize);
  const rewardPips3 = Math.round(Math.abs(tp3Price - entry) / pipSize);

  const confidence = score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

  return {
    pair,
    currentPrice: Number(currentPrice.toFixed(decimals)),
    direction,
    orderType: orderRecommendation.orderType,
    orderTypeDescription: getOrderTypeDescription(orderRecommendation.orderType),
    orderRecommendation,
    entry: Number(entry.toFixed(decimals)),
    stopLoss: Number(stopLossPrice.toFixed(decimals)),
    takeProfit1: Number(tp1Price.toFixed(decimals)),
    takeProfit2: Number(tp2Price.toFixed(decimals)),
    takeProfit3: Number(tp3Price.toFixed(decimals)),
    riskPips: stopLossPips,
    rewardPips1, rewardPips2, rewardPips3,
    riskReward1: (rewardPips1 / stopLossPips).toFixed(1),
    riskReward2: (rewardPips2 / stopLossPips).toFixed(1),
    riskReward3: (rewardPips3 / stopLossPips).toFixed(1),
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
    sessionAnalysis,
    signalScore: score,
    timeframe,
    reasons,
    patterns,
    chartPatterns,
    supplyDemandZones,
    orderBlocks,
    fairValueGaps,
    liquidityLevels,
    backtest,
    multiTimeframeConsensus: mtfConsensus.consensus,
    multiTimeframeStrength: mtfConsensus.strength,
    confluences,
    dataSource,
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };