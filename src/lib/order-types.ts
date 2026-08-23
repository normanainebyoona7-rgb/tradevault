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
  const reasons: string[] = [];
  
  if (direction === "long") {
    // Check if price is near support (good for buy limit)
    const distanceToSupport = currentPrice - supportLevel;
    const atrThreshold = atr * 1.5;
    
    if (rsi < 30) {
      // Oversold - aggressive buy at market
      return {
        orderType: "MARKET_BUY",
        entryPrice: currentPrice,
        reason: "RSI oversold (<30). Immediate bullish reversal expected. Enter at market.",
        confidence: 85,
      };
    } else if (currentPrice <= bollingerLower) {
      // At lower Bollinger band - buy limit at support
      return {
        orderType: "BUY_LIMIT",
        entryPrice: supportLevel,
        reason: "Price at lower Bollinger band. Buy limit at support level for better entry.",
        confidence: 80,
      };
    } else if (distanceToSupport < atrThreshold && trendBias.includes("UPTREND")) {
      // Near support in uptrend - buy limit
      return {
        orderType: "BUY_LIMIT",
        entryPrice: supportLevel,
        reason: "Price near support in uptrend. Buy limit at support for optimal entry.",
        confidence: 75,
      };
    } else if (trendBias === "STRONG UPTREND" && rsi < 50) {
      // Strong uptrend, RSI not overbought - buy market
      return {
        orderType: "MARKET_BUY",
        entryPrice: currentPrice,
        reason: "Strong uptrend with RSI below 50. Enter immediately to catch momentum.",
        confidence: 70,
      };
    } else if (currentPrice > resistanceLevel && trendBias.includes("UPTREND")) {
      // Breakout above resistance - buy stop
      return {
        orderType: "BUY_STOP",
        entryPrice: resistanceLevel + atr * 0.2,
        reason: "Price breaking above resistance. Buy stop above resistance to confirm breakout.",
        confidence: 65,
      };
    } else {
      // Default - buy limit at support
      return {
        orderType: "BUY_LIMIT",
        entryPrice: supportLevel,
        reason: "Buy limit at support level for best risk/reward ratio.",
        confidence: 60,
      };
    }
  } else {
    // Short direction
    const distanceToResistance = resistanceLevel - currentPrice;
    const atrThreshold = atr * 1.5;
    
    if (rsi > 70) {
      // Overbought - aggressive sell at market
      return {
        orderType: "MARKET_SELL",
        entryPrice: currentPrice,
        reason: "RSI overbought (>70). Immediate bearish reversal expected. Enter at market.",
        confidence: 85,
      };
    } else if (currentPrice >= bollingerUpper) {
      // At upper Bollinger band - sell limit at resistance
      return {
        orderType: "SELL_LIMIT",
        entryPrice: resistanceLevel,
        reason: "Price at upper Bollinger band. Sell limit at resistance level for better entry.",
        confidence: 80,
      };
    } else if (distanceToResistance < atrThreshold && trendBias.includes("DOWNTREND")) {
      // Near resistance in downtrend - sell limit
      return {
        orderType: "SELL_LIMIT",
        entryPrice: resistanceLevel,
        reason: "Price near resistance in downtrend. Sell limit at resistance for optimal entry.",
        confidence: 75,
      };
    } else if (trendBias === "STRONG DOWNTREND" && rsi > 50) {
      // Strong downtrend, RSI not oversold - sell market
      return {
        orderType: "MARKET_SELL",
        entryPrice: currentPrice,
        reason: "Strong downtrend with RSI above 50. Enter immediately to catch momentum.",
        confidence: 70,
      };
    } else if (currentPrice < supportLevel && trendBias.includes("DOWNTREND")) {
      // Breakdown below support - sell stop
      return {
        orderType: "SELL_STOP",
        entryPrice: supportLevel - atr * 0.2,
        reason: "Price breaking below support. Sell stop below support to confirm breakdown.",
        confidence: 65,
      };
    } else {
      // Default - sell limit at resistance
      return {
        orderType: "SELL_LIMIT",
        entryPrice: resistanceLevel,
        reason: "Sell limit at resistance level for best risk/reward ratio.",
        confidence: 60,
      };
    }
  }
}

export function getOrderTypeDescription(orderType: OrderType): string {
  const descriptions: Record<OrderType, string> = {
    "BUY_LIMIT": "Buy Limit - Place buy order below current price at support level",
    "SELL_LIMIT": "Sell Limit - Place sell order above current price at resistance level",
    "BUY_STOP": "Buy Stop - Place buy order above current price to catch breakout",
    "SELL_STOP": "Sell Stop - Place sell order below current price to catch breakdown",
    "MARKET_BUY": "Market Buy - Enter immediately at current market price",
    "MARKET_SELL": "Market Sell - Enter immediately at current market price",
  };
  return descriptions[orderType] || "Unknown order type";
}