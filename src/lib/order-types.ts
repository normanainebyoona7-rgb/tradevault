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
    
    // BUY LIMIT - Price near support (best for buying)
    if (distanceToSupport < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(supportLevel.toFixed(5)),
        reason: `BUY LIMIT at support ${supportLevel.toFixed(5)}. Price near support - wait for pullback to this level.`,
        confidence: 85,
      };
    }
    
    // BUY LIMIT - Price at lower Bollinger band
    if (currentPrice <= bollingerLower + atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(bollingerLower.toFixed(5)),
        reason: `BUY LIMIT at lower Bollinger band ${bollingerLower.toFixed(5)}. Mean reversion expected.`,
        confidence: 80,
      };
    }
    
    // BUY STOP - Breakout above resistance
    if (distanceToResistance < atrThreshold * 2 && (trendBias === "UPTREND" || trendBias === "STRONG UPTREND")) {
      return {
        orderType: "BUY_STOP",
        entryPrice: Number((resistanceLevel + atr * 0.2).toFixed(5)),
        reason: `BUY STOP above resistance ${resistanceLevel.toFixed(5)}. Wait for breakout confirmation.`,
        confidence: 75,
      };
    }
    
    // BUY LIMIT - Strong uptrend pullback
    if (trendBias === "STRONG UPTREND" && distanceToSupport < atrThreshold * 3) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: Number(supportLevel.toFixed(5)),
        reason: `BUY LIMIT at support ${supportLevel.toFixed(5)}. Strong uptrend pullback - buy the dip.`,
        confidence: 70,
      };
    }
    
    // Default: BUY LIMIT at support
    return {
      orderType: "BUY_LIMIT",
      entryPrice: Number(supportLevel.toFixed(5)),
      reason: `BUY LIMIT at support ${supportLevel.toFixed(5)} for best risk/reward.`,
      confidence: 60,
    };
    
  } else {
    // SHORT direction
    const distanceToResistance = resistanceLevel - currentPrice;
    const distanceToSupport = currentPrice - supportLevel;
    
    // SELL LIMIT - Price near resistance (best for selling)
    if (distanceToResistance < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(resistanceLevel.toFixed(5)),
        reason: `SELL LIMIT at resistance ${resistanceLevel.toFixed(5)}. Price near resistance - wait for rally to this level.`,
        confidence: 85,
      };
    }
    
    // SELL LIMIT - Price at upper Bollinger band
    if (currentPrice >= bollingerUpper - atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(bollingerUpper.toFixed(5)),
        reason: `SELL LIMIT at upper Bollinger band ${bollingerUpper.toFixed(5)}. Mean reversion expected.`,
        confidence: 80,
      };
    }
    
    // SELL STOP - Breakdown below support
    if (distanceToSupport < atrThreshold * 2 && (trendBias === "DOWNTREND" || trendBias === "STRONG DOWNTREND")) {
      return {
        orderType: "SELL_STOP",
        entryPrice: Number((supportLevel - atr * 0.2).toFixed(5)),
        reason: `SELL STOP below support ${supportLevel.toFixed(5)}. Wait for breakdown confirmation.`,
        confidence: 75,
      };
    }
    
    // SELL LIMIT - Strong downtrend rally
    if (trendBias === "STRONG DOWNTREND" && distanceToResistance < atrThreshold * 3) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: Number(resistanceLevel.toFixed(5)),
        reason: `SELL LIMIT at resistance ${resistanceLevel.toFixed(5)}. Strong downtrend rally - sell the rally.`,
        confidence: 70,
      };
    }
    
    // Default: SELL LIMIT at resistance
    return {
      orderType: "SELL_LIMIT",
      entryPrice: Number(resistanceLevel.toFixed(5)),
      reason: `SELL LIMIT at resistance ${resistanceLevel.toFixed(5)} for best risk/reward.`,
      confidence: 60,
    };
  }
}

export function getOrderTypeDescription(orderType: OrderType): string {
  const descriptions: Record<OrderType, string> = {
    "BUY_LIMIT": "BUY LIMIT ORDER - Buy at support level below current price. Wait for price to drop to entry.",
    "SELL_LIMIT": "SELL LIMIT ORDER - Sell at resistance level above current price. Wait for price to rise to entry.",
    "BUY_STOP": "BUY STOP ORDER - Buy above current price on breakout. Order triggers when price breaks resistance.",
    "SELL_STOP": "SELL STOP ORDER - Sell below current price on breakdown. Order triggers when price breaks support.",
  };
  return descriptions[orderType] || "Unknown order type";
}