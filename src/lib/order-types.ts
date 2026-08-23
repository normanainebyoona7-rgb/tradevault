// src/lib/order-types.ts

export type OrderType = "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP" | "MARKET_BUY" | "MARKET_SELL";

export interface OrderRecommendation {
  orderType: OrderType;
  entryPrice: number;
  reason: string;
  confidence: number;
}

export function determineOrderType(
  direction: "long" | "short",
  currentPrice: number,
  supportLevel: number,
  resistanceLevel: number,
  rsi: number,
  bollingerUpper: number,
  bollingerLower: number,
  trendBias: string,
  atr: number,
): OrderRecommendation {
  
  const atrThreshold = atr * 1.5;
  
  if (direction === "long") {
    const distanceToSupport = currentPrice - supportLevel;
    
    // Near support → BUY LIMIT recommendation
    if (distanceToSupport < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: currentPrice, // Entry at market price
        reason: `Price near support. Ideal buy zone.`,
        confidence: 85,
      };
    }
    
    // Strong uptrend → MARKET BUY
    if (trendBias === "STRONG UPTREND" && rsi < 60) {
      return {
        orderType: "MARKET_BUY",
        entryPrice: currentPrice,
        reason: `Strong uptrend with RSI at ${rsi}. Enter at market.`,
        confidence: 75,
      };
    }
    
    // Breakout → BUY STOP recommendation
    if (distanceToSupport > atrThreshold * 3 && trendBias.includes("UPTREND")) {
      return {
        orderType: "BUY_STOP",
        entryPrice: currentPrice,
        reason: `Momentum building for breakout.`,
        confidence: 65,
      };
    }
    
    return {
      orderType: "MARKET_BUY",
      entryPrice: currentPrice,
      reason: `Buy at market price.`,
      confidence: 60,
    };
    
  } else {
    const distanceToResistance = resistanceLevel - currentPrice;
    
    // Near resistance → SELL LIMIT recommendation
    if (distanceToResistance < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: currentPrice,
        reason: `Price near resistance. Ideal sell zone.`,
        confidence: 85,
      };
    }
    
    // Strong downtrend → MARKET SELL
    if (trendBias === "STRONG DOWNTREND" && rsi > 40) {
      return {
        orderType: "MARKET_SELL",
        entryPrice: currentPrice,
        reason: `Strong downtrend with RSI at ${rsi}. Enter at market.`,
        confidence: 75,
      };
    }
    
    // Breakdown → SELL STOP recommendation
    if (distanceToResistance > atrThreshold * 3 && trendBias.includes("DOWNTREND")) {
      return {
        orderType: "SELL_STOP",
        entryPrice: currentPrice,
        reason: `Momentum building for breakdown.`,
        confidence: 65,
      };
    }
    
    return {
      orderType: "MARKET_SELL",
      entryPrice: currentPrice,
      reason: `Sell at market price.`,
      confidence: 60,
    };
  }
}

export function getOrderTypeDescription(orderType: OrderType): string {
  const descriptions: Record<OrderType, string> = {
    "BUY_LIMIT": "Buy Limit - Recommended buy zone near support",
    "SELL_LIMIT": "Sell Limit - Recommended sell zone near resistance",
    "BUY_STOP": "Buy Stop - Potential breakout buy",
    "SELL_STOP": "Sell Stop - Potential breakdown sell",
    "MARKET_BUY": "Market Buy - Enter at current market price",
    "MARKET_SELL": "Market Sell - Enter at current market price",
  };
  return descriptions[orderType] || "Unknown order type";
}