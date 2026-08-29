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

function timeframeToYahooInterval(timeframe: string): string {
  const intervalMap: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1H": "1h",
    "4H": "4h",
    "1D": "1d",
    "1W": "1wk",
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

  const recentPrices = prices.slice(-20);
  
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

  if (swings.length === 0) {
    const support = Math.min(...recentPrices);
    const resistance = Math.max(...recentPrices);
    return { support, resistance };
  }

  const currentPrice = recentPrices[recentPrices.length - 1];
  const supports = swings.filter(s => s < currentPrice);
  const resistances = swings.filter(r => r > currentPrice);
  
  const support = supports.length > 0 ? Math.max(...supports) : Math.min(...recentPrices);
  const resistance = resistances.length > 0 ? Math.min(...resistances) : Math.max(...recentPrices);

  return { support, resistance };
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
    "LONDON": `London session active. High liquidity for ${pair}. Best time for EUR/GBP pairs. Expect strong directional moves.`,
    "NEW YORK": `New York session active. USD volatility high. Best for ${pair} with dollar exposure. Major news releases expected.`,
    "ASIAN": `Asian session active. Lower volatility. Good for range-bound strategies on ${pair}.`,
    "OTHER": `Off-peak hours. Reduced liquidity for ${pair}. Use wider stops and smaller position sizes.`,
  };
  return sessionDetails[session] || sessionDetails["OTHER"];
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
  chartPatterns: ChartPattern[],
): "long" | "short" {
  let longScore = 0;
  let shortScore = 0;

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

  if (currentPrice <= bollingerLower) longScore += 2;
  if (currentPrice >= bollingerUpper) shortScore += 2;

  const bullishPatterns = chartPatterns.filter(p => p.type === "bullish");
  const bearishPatterns = chartPatterns.filter(p => p.type === "bearish");
  
  if (bullishPatterns.length > 0) longScore += bullishPatterns.length * 2;
  if (bearishPatterns.length > 0) shortScore += bearishPatterns.length * 2;

  const distanceToSupport = Math.abs(currentPrice - support);
  const distanceToResistance = Math.abs(resistance - currentPrice);
  if (distanceToSupport < distanceToResistance) longScore += 1;
  else shortScore += 1;

  return longScore > shortScore ? "long" : "short";
}

function calculateSignalScore(
  trendBias: string,
  rsi: number,
  atr: number,
  currentPrice: number,
  macdHistogram: number,
  session: string,
  support: number,
  resistance: number,
  chartPatterns: ChartPattern[],
  supplyDemandZones: SupplyDemandZone[],
): { score: number; reasons: string[]; confluences: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const confluences: string[] = [];

  if (trendBias === "STRONG UPTREND" || trendBias === "STRONG DOWNTREND") {
    score += 30;
    reasons.push("Strong trend alignment (+30)");
    confluences.push(`Trend: ${trendBias}`);
  } else if (trendBias === "UPTREND" || trendBias === "DOWNTREND") {
    score += 20;
    reasons.push("Moderate trend alignment (+20)");
    confluences.push(`Trend: ${trendBias}`);
  } else {
    score += 10;
    reasons.push("Neutral trend (+10)");
    confluences.push(`Trend: ${trendBias}`);
  }

  if (rsi > 30 && rsi < 70) {
    score += 20;
    reasons.push("RSI in optimal range (+20)");
    confluences.push(`RSI: ${rsi} (optimal)`);
  } else if (rsi > 20 && rsi < 80) {
    score += 10;
    reasons.push("RSI acceptable (+10)");
    confluences.push(`RSI: ${rsi} (acceptable)`);
  } else {
    reasons.push("RSI extreme - caution (+0)");
    confluences.push(`RSI: ${rsi} (extreme)`);
  }

  if (Math.abs(macdHistogram) > 0) {
    score += 20;
    reasons.push("MACD confirms momentum (+20)");
    confluences.push(`MACD: ${macdHistogram > 0 ? "Bullish" : "Bearish"} momentum`);
  }

  if (chartPatterns.length > 0) {
    score += Math.min(chartPatterns.length * 5, 15);
    reasons.push(`Chart patterns detected (+${Math.min(chartPatterns.length * 5, 15)})`);
    chartPatterns.forEach(p => {
      confluences.push(`Pattern: ${p.name} (${p.type}, Strength: ${p.strength}/10)`);
    });
  }

  if (supplyDemandZones.length > 0) {
    score += Math.min(supplyDemandZones.length * 5, 15);
    reasons.push(`Supply/Demand zones found (+${Math.min(supplyDemandZones.length * 5, 15)})`);
    supplyDemandZones.forEach(z => {
      confluences.push(`${z.type.toUpperCase()} zone: ${z.bottom} - ${z.top}`);
    });
  }

  if (session === "LONDON" || session === "NEW YORK") {
    score += 10;
    confluences.push(`Session: ${session} (high liquidity)`);
  } else {
    score += 5;
    confluences.push(`Session: ${session} (moderate liquidity)`);
  }

  return { score, reasons, confluences };
}

// ===== DATA FETCHING =====

export async function getRealHistoricalData(pair: string, interval: string = "1d"): Promise<number[]> {
  const yahooInterval = timeframeToYahooInterval(interval);
  
  try {
    const symbol = toYahooSymbol(pair);
    const queryOptions = {
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: yahooInterval as any,
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

export async function getLivePrice(pair: string, timeframe: string = "1H"): Promise<number> {
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
      
      if (prices.length > 0) {
        return prices[prices.length - 1];
      }
    }
  } catch (error) {
    console.error(`Yahoo live price failed for ${pair}:`, error);
  }
  
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
  const pipSize = calculatePipSize(pair);
  const spread = getExnessSpread(pair);
  const [, quote] = pair.split("/");

  let decimals = 5;
  if (quote === "JPY") decimals = 3;
  if (pair.includes("XAU")) decimals = 2;
  if (pair.includes("XAG")) decimals = 3;
  if (pair.includes("BTC")) decimals = 2;
  if (pair.includes("ETH")) decimals = 2;

  const priceHistory = await getRealHistoricalData(pair, timeframe);

  const highs = priceHistory.map((p, i) => Math.max(p, priceHistory[i - 1] || p) * 1.001);
  const lows = priceHistory.map((p, i) => Math.min(p, priceHistory[i - 1] || p) * 0.999);

  const ma20 = calculateSMA(priceHistory, 20);
  const ma50 = calculateSMA(priceHistory, 50);
  const ma200 = calculateSMA(priceHistory, 200);
  const rsi = calculateRSI(priceHistory);
  const atr = calculateATR(priceHistory);
  const macdData = calculateMACD(priceHistory);
  const bollinger = calculateBollingerBands(priceHistory);

  const { support, resistance } = findSupportResistance(priceHistory);

  const trendBias = determineTrend(ma20, ma50, ma200);

  const session = getCurrentSession();
  const sessionAnalysis = getSessionAnalysis(session, pair);

  const { chartPatterns, supplyDemandZones } = analyzeAllPatterns(priceHistory, highs, lows);
  const { orderBlocks, fairValueGaps, liquidityLevels } = analyzeSmartMoney(priceHistory, highs, lows);

  const direction = determineDirection(
    trendBias,
    currentPrice,
    support,
    resistance,
    rsi,
    macdData.histogram,
    bollinger.upper,
    bollinger.lower,
    chartPatterns,
  );

  const { score, reasons, confluences } = calculateSignalScore(
    trendBias,
    rsi,
    atr,
    currentPrice,
    macdData.histogram,
    session,
    support,
    resistance,
    chartPatterns,
    supplyDemandZones,
  );

  const atrBasedStop = Math.max(atr * 1.0, pipSize * 5);
  const stopLossPips = pair.includes("XAU") ? 50 : pair.includes("BTC") ? 100 : Math.round(atrBasedStop / pipSize);

  const patterns = detectPatterns(priceHistory, highs, lows);

  const backtest = backtestStrategy(
    priceHistory,
    direction,
    stopLossPips,
    Math.round(stopLossPips * 1.5),
    pipSize,
  );

  const timeframeAnalyses = await analyzeMultipleTimeframes(pair);
  const mtfConsensus = getMultiTimeframeConsensus(timeframeAnalyses);

  const orderRecommendation = determineOrderType(
    direction,
    currentPrice,
    support,
    resistance,
    rsi,
    bollinger.upper,
    bollinger.lower,
    trendBias,
    atr,
  );

  // Entry based on Smart Money levels (Order Blocks, FVG, Liquidity)
  let entry: number;
  
  if (direction === "long") {
    const bullishBlocks = orderBlocks.filter(ob => ob.type === "bullish" && ob.bottom < currentPrice);
    const bullishFVGs = fairValueGaps.filter(fvg => fvg.type === "bullish" && fvg.bottom < currentPrice);
    const sellSideLiquidity = liquidityLevels.filter(liq => liq.type === "sell_side" && liq.price < currentPrice);
    
    const candidates: number[] = [];
    
    if (bullishBlocks.length > 0) {
      const nearestBlock = bullishBlocks.reduce((closest, block) => 
        Math.abs(block.bottom - currentPrice) < Math.abs(closest.bottom - currentPrice) ? block : closest
      );
      candidates.push(nearestBlock.bottom);
    }
    
    if (bullishFVGs.length > 0) {
      const nearestFVG = bullishFVGs.reduce((closest, fvg) => 
        Math.abs(fvg.bottom - currentPrice) < Math.abs(closest.bottom - currentPrice) ? fvg : closest
      );
      candidates.push(nearestFVG.bottom);
    }
    
    if (sellSideLiquidity.length > 0) {
      const nearestLiquidity = sellSideLiquidity.reduce((closest, liq) => 
        Math.abs(liq.price - currentPrice) < Math.abs(closest.price - currentPrice) ? liq : closest
      );
      candidates.push(nearestLiquidity.price);
    }
    
    if (candidates.length > 0) {
      // Use the HIGHEST candidate (closest to current price but still below)
      entry = Math.max(...candidates);
    } else {
      entry = support;
    }
  } else {
    const bearishBlocks = orderBlocks.filter(ob => ob.type === "bearish" && ob.top > currentPrice);
    const bearishFVGs = fairValueGaps.filter(fvg => fvg.type === "bearish" && fvg.top > currentPrice);
    const buySideLiquidity = liquidityLevels.filter(liq => liq.type === "buy_side" && liq.price > currentPrice);
    
    const candidates: number[] = [];
    
    if (bearishBlocks.length > 0) {
      const nearestBlock = bearishBlocks.reduce((closest, block) => 
        Math.abs(block.top - currentPrice) < Math.abs(closest.top - currentPrice) ? block : closest
      );
      candidates.push(nearestBlock.top);
    }
    
    if (bearishFVGs.length > 0) {
      const nearestFVG = bearishFVGs.reduce((closest, fvg) => 
        Math.abs(fvg.top - currentPrice) < Math.abs(closest.top - currentPrice) ? fvg : closest
      );
      candidates.push(nearestFVG.top);
    }
    
    if (buySideLiquidity.length > 0) {
      const nearestLiquidity = buySideLiquidity.reduce((closest, liq) => 
        Math.abs(liq.price - currentPrice) < Math.abs(closest.price - currentPrice) ? liq : closest
      );
      candidates.push(nearestLiquidity.price);
    }
    
    if (candidates.length > 0) {
      // Use the LOWEST candidate (closest to current price but still above)
      entry = Math.min(...candidates);
    } else {
      entry = resistance;
    }
  }

  const slDistance = stopLossPips * pipSize;
  
  let stopLossPrice: number;
  let tp1Price: number;
  let tp2Price: number;
  let tp3Price: number;

  if (direction === "long") {
    stopLossPrice = entry - slDistance;
    tp1Price = entry + slDistance * 1.0;
    tp2Price = entry + slDistance * 1.5;
    tp3Price = entry + slDistance * 2.0;
  } else {
    stopLossPrice = entry + slDistance;
    tp1Price = entry - slDistance * 1.0;
    tp2Price = entry - slDistance * 1.5;
    tp3Price = entry - slDistance * 2.0;
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
    rewardPips1,
    rewardPips2,
    rewardPips3,
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
  };
}

export { FALLBACK_PRICES, EXNESS_SPREADS };