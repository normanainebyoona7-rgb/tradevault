// src/lib/forex-data.ts

import YahooFinance from "yahoo-finance2";
import { detectPatterns, CandlestickPattern } from "./patterns";
import { backtestStrategy, BacktestResult } from "./backtest";
import { analyzeMultipleTimeframes, getMultiTimeframeConsensus } from "./multi-timeframe";
import { determineOrderType, OrderType, getOrderTypeDescription, OrderRecommendation } from "./order-types";
import { analyzeAllPatterns, ChartPattern, SupplyDemandZone } from "./advanced-patterns";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface ImageLevels {
  support: number[];
  resistance: number[];
  yMin: number;
  yMax: number;
  trend: string;
  greenPct: number;
}

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
  backtest: BacktestResult;
  multiTimeframeConsensus: string;
  multiTimeframeStrength: number;
  confluences: string[];
  imageLevels: ImageLevels | null;
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

interface TimeframeConfig {
  atrMultiplier: number;
  minSlPercent: number;
  rsiPeriod: number;
  ma20: number; ma50: number; ma200: number;
  bbPeriod: number;
  macdFast: number; macdSlow: number; macdSignal: number;
  srLookback: number;
}

function getTimeframeConfig(timeframe: string): TimeframeConfig {
  const configs: Record<string, TimeframeConfig> = {
    "1m": { atrMultiplier: 1.5, minSlPercent: 0.0008, rsiPeriod: 7, ma20: 10, ma50: 25, ma200: 100, bbPeriod: 10, macdFast: 6, macdSlow: 13, macdSignal: 5, srLookback: 15 },
    "5m": { atrMultiplier: 1.5, minSlPercent: 0.0012, rsiPeriod: 9, ma20: 15, ma50: 35, ma200: 150, bbPeriod: 15, macdFast: 8, macdSlow: 17, macdSignal: 6, srLookback: 20 },
    "15m": { atrMultiplier: 1.5, minSlPercent: 0.002, rsiPeriod: 11, ma20: 20, ma50: 50, ma200: 150, bbPeriod: 20, macdFast: 10, macdSlow: 22, macdSignal: 8, srLookback: 25 },
    "30m": { atrMultiplier: 1.5, minSlPercent: 0.0025, rsiPeriod: 12, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 30 },
    "1H": { atrMultiplier: 1.5, minSlPercent: 0.003, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 50 },
    "4H": { atrMultiplier: 1.8, minSlPercent: 0.006, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 50 },
    "1D": { atrMultiplier: 2.0, minSlPercent: 0.012, rsiPeriod: 14, ma20: 20, ma50: 50, ma200: 200, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 30 },
    "1W": { atrMultiplier: 2.5, minSlPercent: 0.025, rsiPeriod: 14, ma20: 10, ma50: 30, ma200: 100, bbPeriod: 20, macdFast: 12, macdSlow: 26, macdSignal: 9, srLookback: 20 },
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

function calculateBollingerBands(prices: number[], period: number) {
  if (prices.length < period) {
    const middle = calculateSMA(prices, prices.length);
    return { upper: middle, middle, lower: middle };
  }
  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.map(p => Math.pow(p - middle, 2)).reduce((s, v) => s + v, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: Number((middle + 2 * stdDev).toFixed(5)),
    middle: Number(middle.toFixed(5)),
    lower: Number((middle - 2 * stdDev).toFixed(5)),
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

// ===== DIRECTION: image trend dominates when provided =====

function determineDirection(
  imageLevels: ImageLevels | null,
  trendBias: string,
  lastClose: number,
  support: number,
  resistance: number,
  rsi: number,
  macdHistogram: number,
): "long" | "short" | "neutral" {
  let longScore = 0, shortScore = 0;

  // Image trend has strong weight (uploaded chart is the actual market)
  if (imageLevels) {
    if (imageLevels.trend === "BULLISH") longScore += 4;
    else if (imageLevels.trend === "BEARISH") shortScore += 4;

    // Green percentage
    if (imageLevels.greenPct >= 65) longScore += 2;
    else if (imageLevels.greenPct <= 35) shortScore += 2;
  }

  // Indicator-based scoring
  if (trendBias === "STRONG UPTREND") longScore += 3;
  else if (trendBias === "UPTREND") longScore += 2;
  else if (trendBias === "STRONG DOWNTREND") shortScore += 3;
  else if (trendBias === "DOWNTREND") shortScore += 2;

  if (rsi < 30) longScore += 2;
  else if (rsi > 70) shortScore += 2;
  if (macdHistogram > 0) longScore += 1;
  else if (macdHistogram < 0) shortScore += 1;

  if (longScore > shortScore) return "long";
  if (shortScore > longScore) return "short";
  return "neutral";
}

// ===== SL/TP: image levels drive placement, ATR fallback =====

function placeSlTp(
  direction: "long" | "short",
  entry: number,
  imageLevels: ImageLevels | null,
  atr: number,
  pipSize: number,
  config: TimeframeConfig,
): { sl: number; tp1: number; tp2: number; tp3: number; source: string } {
  // Default ATR-based plan
  const atrPips = atr / pipSize;
  let slPips = Math.max(Math.round(atrPips * config.atrMultiplier), 5);
  const minPips = Math.round((entry * config.minSlPercent) / pipSize);
  slPips = Math.max(slPips, minPips);

  const slDist = slPips * pipSize;

  let sl: number, tp1: number, tp2: number, tp3: number;
  if (direction === "long") {
    sl = entry - slDist;
    tp1 = entry + slDist * 1.0;
    tp2 = entry + slDist * 2.0;
    tp3 = entry + slDist * 3.0;
  } else {
    sl = entry + slDist;
    tp1 = entry - slDist * 1.0;
    tp2 = entry - slDist * 2.0;
    tp3 = entry - slDist * 3.0;
  }

  if (!imageLevels) {
    return { sl, tp1, tp2, tp3, source: "atr" };
  }

  // ===== IMAGE-BASED PLACEMENT =====
  const { support, resistance } = imageLevels;

  if (direction === "long") {
    // SL: just below nearest support below entry
    const supportBelow = support.filter(s => s < entry).sort((a, b) => b - a);
    if (supportBelow.length > 0) {
      sl = supportBelow[0] - slDist * 0.2;
    }

    // TPs: use resistance levels above entry
    const resistAbove = resistance.filter(r => r > entry).sort((a, b) => a - b);
    if (resistAbove.length >= 3) {
      tp1 = resistAbove[0];
      tp2 = resistAbove[1];
      tp3 = resistAbove[2];
    } else if (resistAbove.length === 2) {
      tp1 = resistAbove[0];
      tp2 = resistAbove[1];
      tp3 = entry + (entry - sl) * 3;
    } else if (resistAbove.length === 1) {
      tp1 = resistAbove[0];
      tp2 = entry + (entry - sl) * 2;
      tp3 = entry + (entry - sl) * 3;
    }
  } else {
    // Short
    const resistAbove = resistance.filter(r => r > entry).sort((a, b) => a - b);
    if (resistAbove.length > 0) {
      sl = resistAbove[0] + slDist * 0.2;
    }

    const supportBelow = support.filter(s => s < entry).sort((a, b) => b - a);
    if (supportBelow.length >= 3) {
      tp1 = supportBelow[0];
      tp2 = supportBelow[1];
      tp3 = supportBelow[2];
    } else if (supportBelow.length === 2) {
      tp1 = supportBelow[0];
      tp2 = supportBelow[1];
      tp3 = entry - (sl - entry) * 3;
    } else if (supportBelow.length === 1) {
      tp1 = supportBelow[0];
      tp2 = entry - (sl - entry) * 2;
      tp3 = entry - (sl - entry) * 3;
    }
  }

  // Sanity: TPs must be on the profitable side
  const risk = Math.abs(entry - sl);
  if (risk < pipSize * 5) {
    // too tight, fallback
    return { sl, tp1, tp2, tp3, source: "atr_fallback" };
  }

  return { sl, tp1, tp2, tp3, source: "image" };
}

// ===== DATA FETCHING =====

function shouldUseYahoo(pair: string, timeframe: string): boolean {
  if (pair === "BTC/USD" || pair === "ETH/USD") return ["1H", "4H", "1D", "1W"].includes(timeframe);
  if (pair === "XAU/USD" || pair === "XAG/USD") return true;
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
      if (d.closes && d.closes.length >= 50) {
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
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: interval as any,
    });
    if (result.quotes && result.quotes.length >= 50) {
      const prices = result.quotes.filter(q => q.close != null).map(q => Number(q.close));
      if (prices.length >= 50) {
        console.log(`[Yahoo] ${pair} ${timeframe}: ${prices.length} candles`);
        return prices;
      }
    }
  } catch (e: any) {
    console.error(`Yahoo failed ${pair}: ${e?.message}`);
  }
  return null;
}

export async function getRealHistoricalData(pair: string, interval: string = "1H"): Promise<{ prices: number[]; source: string }> {
  const useYahoo = shouldUseYahoo(pair, interval);

  if (useYahoo) {
    const y = await fetchFromYahoo(pair, interval);
    if (y) return { prices: y, source: "yahoo" };
    const f = await fetchFromFCS(pair, interval);
    if (f) return { prices: f, source: "fcs" };
  } else {
    const f = await fetchFromFCS(pair, interval);
    if (f) return { prices: f, source: "fcs" };
    const y = await fetchFromYahoo(pair, interval);
    if (y) return { prices: y, source: "yahoo" };
  }

  console.warn(`[Fallback] deterministic synthetic for ${pair} ${interval}`);
  const base = FALLBACK_PRICES[pair] || 1.0;
  const prices: number[] = [];
  let price = base;
  const vol = base * 0.01;
  const random = mulberry32(hashString(`${pair}-${interval}`));
  for (let i = 0; i < 200; i++) {
    price += (random() - 0.5) * vol;
    prices.push(price);
  }
  return { prices, source: "synthetic_deterministic" };
}

export async function getLivePrice(pair: string, timeframe: string = "1H"): Promise<number> {
  const useYahoo = shouldUseYahoo(pair, timeframe);
  if (useYahoo) {
    try {
      const symbol = toYahooSymbol(pair);
      const interval = timeframeToYahooInterval(timeframe);
      const r = await yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: interval as any,
      });
      if (r.quotes && r.quotes.length > 0) {
        const prices = r.quotes.filter(q => q.close != null).map(q => Number(q.close));
        if (prices.length > 0) return prices[prices.length - 1];
      }
    } catch {}
  }
  try {
    const url = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const r = await fetch(`${url}/api/get-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair }),
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.price && d.price > 0) return d.price;
    }
  } catch {}
  return FALLBACK_PRICES[pair] || 1.0;
}

// ===== MAIN =====

export async function generateSignalLevels(
  pair: string,
  currentPrice: number,
  timeframe: string = "1H",
  imageLevels: ImageLevels | null = null,
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

  const direction = determineDirection(
    imageLevels, trendBias, lastClose, support, resistance, rsi, macdData.histogram
  );

  // Signal score
  let score = 0;
  const reasons: string[] = [];
  const confluences: string[] = [];

  if (imageLevels) {
    if (imageLevels.trend === "BULLISH" && direction === "long") { score += 25; confluences.push("✅ Image shows bullish structure"); }
    if (imageLevels.trend === "BEARISH" && direction === "short") { score += 25; confluences.push("✅ Image shows bearish structure"); }
    if (imageLevels.support.length > 0) { score += 10; confluences.push(`📍 ${imageLevels.support.length} support levels in image`); }
    if (imageLevels.resistance.length > 0) { score += 10; confluences.push(`📍 ${imageLevels.resistance.length} resistance levels in image`); }
  }

  if (trendBias.includes("UPTREND") && direction === "long") { score += 15; confluences.push(`✅ ${trendBias}`); }
  if (trendBias.includes("DOWNTREND") && direction === "short") { score += 15; confluences.push(`✅ ${trendBias}`); }
  if (macdData.histogram > 0 && direction === "long") { score += 10; confluences.push("✅ MACD bullish"); }
  if (macdData.histogram < 0 && direction === "short") { score += 10; confluences.push("✅ MACD bearish"); }
  if (rsi > 30 && rsi < 70) { score += 10; confluences.push(`✅ RSI healthy (${rsi})`); }

  score = Math.min(score, 100);

  // Place SL/TP
  let sl: number, tp1: number, tp2: number, tp3: number, placementSource: string;
  const entry = currentPrice;

  if (direction === "neutral") {
    sl = entry; tp1 = entry; tp2 = entry; tp3 = entry;
    placementSource = "neutral";
  } else {
    const placed = placeSlTp(direction, entry, imageLevels, atr, pipSize, config);
    sl = placed.sl; tp1 = placed.tp1; tp2 = placed.tp2; tp3 = placed.tp3;
    placementSource = placed.source;
    confluences.push(`🎯 SL/TP placed from ${placementSource === "image" ? "chart image levels" : "ATR"}`);
  }

  const riskPips = Math.round(Math.abs(entry - sl) / pipSize);
  const rewardPips1 = Math.round(Math.abs(tp1 - entry) / pipSize);
  const rewardPips2 = Math.round(Math.abs(tp2 - entry) / pipSize);
  const rewardPips3 = Math.round(Math.abs(tp3 - entry) / pipSize);

  const rr1 = riskPips > 0 ? (rewardPips1 / riskPips).toFixed(1) : "0";
  const rr2 = riskPips > 0 ? (rewardPips2 / riskPips).toFixed(1) : "0";
  const rr3 = riskPips > 0 ? (rewardPips3 / riskPips).toFixed(1) : "0";

  const confidence = direction === "neutral" ? "NEUTRAL" : score >= 70 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

  console.log(`[Signal] ${pair} ${timeframe}: dir=${direction} src=${placementSource} entry=${entry.toFixed(4)} sl=${sl.toFixed(4)} tp1=${tp1.toFixed(4)} score=${score}`);

  const patterns = detectPatterns(priceHistory, highs, lows);
  const backtest = backtestStrategy(priceHistory, direction === "neutral" ? "long" : direction, riskPips, rewardPips1, pipSize);
  const timeframeAnalyses = await analyzeMultipleTimeframes(pair);
  const mtfConsensus = getMultiTimeframeConsensus(timeframeAnalyses);

  const orderRecommendation = determineOrderType(
    direction === "neutral" ? "long" : direction,
    entry, support, resistance, rsi, bollinger.upper, bollinger.lower, trendBias, atr
  );

  return {
    pair,
    currentPrice: Number(currentPrice.toFixed(decimals)),
    direction,
    orderType: orderRecommendation.orderType,
    orderTypeDescription: getOrderTypeDescription(orderRecommendation.orderType),
    orderRecommendation,
    entry: Number(entry.toFixed(decimals)),
    stopLoss: Number(sl.toFixed(decimals)),
    takeProfit1: Number(tp1.toFixed(decimals)),
    takeProfit2: Number(tp2.toFixed(decimals)),
    takeProfit3: Number(tp3.toFixed(decimals)),
    riskPips,
    rewardPips1, rewardPips2, rewardPips3,
    riskReward1: rr1,
    riskReward2: rr2,
    riskReward3: rr3,
    confidence,
    confidenceScore: direction === "neutral" ? 0 : score,
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
    backtest,
    multiTimeframeConsensus: mtfConsensus.consensus,
    multiTimeframeStrength: mtfConsensus.strength,
    confluences,
    imageLevels,
    dataSource,
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };