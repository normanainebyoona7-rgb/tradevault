// src/lib/order-types.ts

export type OrderType = "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP";

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
    const distanceToResistance = resistanceLevel - currentPrice;
    const distanceToBollingerLower = currentPrice - bollingerLower;
    
    // 1. PRICE AT OR NEAR SUPPORT → BUY LIMIT
    if (distanceToSupport < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(supportLevel.toFixed(5)),
        reason: `Price near support. Buy limit at support (${supportLevel.toFixed(5)}) for optimal entry.`,
        confidence: 85,
      };
    }
    
    // 2. PRICE AT LOWER BOLLINGER BAND → BUY LIMIT
    if (distanceToBollingerLower < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(bollingerLower.toFixed(5)),
        reason: `Price at lower Bollinger band. Buy limit at ${bollingerLower.toFixed(5)} for mean reversion.`,
        confidence: 80,
      };
    }
    
    // 3. BREAKOUT ABOVE RESISTANCE → BUY STOP
    if (distanceToResistance < atrThreshold * 2 && (trendBias === "UPTREND" || trendBias === "STRONG UPTREND")) {
      return {
        orderType: "BUY_STOP",
        entryPrice: Number((resistanceLevel + atr * 0.2).toFixed(5)),
        reason: `Price approaching resistance. Buy stop above ${resistanceLevel.toFixed(5)} to catch breakout.`,
        confidence: 75,
      };
    }
    
    // 4. STRONG UPTREND PULLBACK → BUY LIMIT at support
    if (trendBias === "STRONG UPTREND" && distanceToSupport < atrThreshold * 3) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(supportLevel.toFixed(5)),
        reason: `Strong uptrend pullback. Buy limit at support (${supportLevel.toFixed(5)}) for continuation.`,
        confidence: 70,
      };
    }
    
    // 5. DEFAULT → BUY LIMIT at support
    return {
      orderType: "BUY_LIMIT",
      entryPrice: Number(supportLevel.toFixed(5)),
      reason: `Buy limit at support level (${supportLevel.toFixed(5)}) for best risk/reward.`,
      confidence: 60,
    };
    
  } else {
    // SHORT direction
    const distanceToResistance = resistanceLevel - currentPrice;
    const distanceToSupport = currentPrice - supportLevel;
    const distanceToBollingerUpper = bollingerUpper - currentPrice;
    
    // 1. PRICE AT OR NEAR RESISTANCE → SELL LIMIT
    if (distanceToResistance < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(resistanceLevel.toFixed(5)),
        reason: `Price near resistance. Sell limit at resistance (${resistanceLevel.toFixed(5)}) for optimal entry.`,
        confidence: 85,
      };
    }
    
    // 2. PRICE AT UPPER BOLLINGER BAND → SELL LIMIT
    if (distanceToBollingerUpper < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(bollingerUpper.toFixed(5)),
        reason: `Price at upper Bollinger band. Sell limit at ${bollingerUpper.toFixed(5)} for mean reversion.`,
        confidence: 80,
      };
    }
    
    // 3. BREAKDOWN BELOW SUPPORT → SELL STOP
    if (distanceToSupport < atrThreshold * 2 && (trendBias === "DOWNTREND" || trendBias === "STRONG DOWNTREND")) {
      return {
        orderType: "SELL_STOP",
        entryPrice: Number((supportLevel - atr * 0.2).toFixed(5)),
        reason: `Price approaching support. Sell stop below ${supportLevel.toFixed(5)} to catch breakdown.`,
        confidence: 75,
      };
    }
    
    // 4. STRONG DOWNTREND PULLBACK → SELL LIMIT at resistance
    if (trendBias === "STRONG DOWNTREND" && distanceToResistance < atrThreshold * 3) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(resistanceLevel.toFixed(5)),
        reason: `Strong downtrend pullback. Sell limit at resistance (${resistanceLevel.toFixed(5)}) for continuation.`,
        confidence: 70,
      };
    }
    
    // 5. DEFAULT → SELL LIMIT at resistance
    return {
      orderType: "SELL_LIMIT",
      entryPrice: Number(resistanceLevel.toFixed(5)),
      reason: `Sell limit at resistance level (${resistanceLevel.toFixed(5)}) for best risk/reward.`,
      confidence: 60,
    };
  }
}

export function getOrderTypeDescription(orderType: OrderType): string {
  const descriptions: Record<OrderType, string> = {
    "BUY_LIMIT": "Buy Limit - Place buy order below current price at support level",
    "SELL_LIMIT": "Sell Limit - Place sell order above current price at resistance level",
    "BUY_STOP": "Buy Stop - Place buy order above current price to catch breakout",
    "SELL_STOP": "Sell Stop - Place sell order below current price to catch breakdown",
  };
  return descriptions[orderType] || "Unknown order type";
}