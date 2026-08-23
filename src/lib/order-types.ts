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
    const distanceToResistance = resistanceLevel - currentPrice;
    const distanceToBollingerLower = currentPrice - bollingerLower;
    
    // 1. PRICE AT OR NEAR SUPPORT → BUY LIMIT (best risk/reward)
    if (distanceToSupport < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: supportLevel,
        reason: `Price near support (${supportLevel}). Buy limit at support for optimal entry with best risk/reward.`,
        confidence: 85,
      };
    }
    
    // 2. PRICE AT LOWER BOLLINGER BAND → BUY LIMIT
    if (distanceToBollingerLower < atrThreshold) {
      return {
        orderType: "BUY_LIMIT",
        entryPrice: bollingerLower,
        reason: `Price at lower Bollinger band (${bollingerLower}). Buy limit at band for mean reversion.`,
        confidence: 80,
      };
    }
    
    // 3. STRONG UPTREND + RSI NOT OVERBOUGHT → MARKET BUY (momentum)
    if (trendBias === "STRONG UPTREND" && rsi > 40 && rsi < 60) {
      return {
        orderType: "MARKET_BUY",
        entryPrice: currentPrice,
        reason: `Strong uptrend with RSI at ${rsi}. Enter immediately to ride momentum.`,
        confidence: 75,
      };
    }
    
    // 4. BREAKOUT ABOVE RESISTANCE → BUY STOP
    if (distanceToResistance < atrThreshold && trendBias.includes("UPTREND")) {
      return {
        orderType: "BUY_STOP",
        entryPrice: resistanceLevel + atr * 0.2,
        reason: `Price approaching resistance (${resistanceLevel}). Buy stop above resistance to catch breakout.`,
        confidence: 70,
      };
    }
    
    // 5. RSI OVERSOLD → MARKET BUY (reversal)
    if (rsi < 30) {
      return {
        orderType: "MARKET_BUY",
        entryPrice: currentPrice,
        reason: `RSI oversold at ${rsi}. Strong bullish reversal expected. Enter at market.`,
        confidence: 65,
      };
    }
    
    // 6. DEFAULT → BUY LIMIT at support
    return {
      orderType: "BUY_LIMIT",
      entryPrice: supportLevel,
      reason: `Buy limit at support (${supportLevel}) for best risk/reward ratio.`,
      confidence: 60,
    };
    
  } else {
    // SHORT direction
    const distanceToResistance = resistanceLevel - currentPrice;
    const distanceToSupport = currentPrice - supportLevel;
    const distanceToBollingerUpper = bollingerUpper - currentPrice;
    
    // 1. PRICE AT OR NEAR RESISTANCE → SELL LIMIT (best risk/reward)
    if (distanceToResistance < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: resistanceLevel,
        reason: `Price near resistance (${resistanceLevel}). Sell limit at resistance for optimal entry.`,
        confidence: 85,
      };
    }
    
    // 2. PRICE AT UPPER BOLLINGER BAND → SELL LIMIT
    if (distanceToBollingerUpper < atrThreshold) {
      return {
        orderType: "SELL_LIMIT",
        entryPrice: bollingerUpper,
        reason: `Price at upper Bollinger band (${bollingerUpper}). Sell limit at band for mean reversion.`,
        confidence: 80,
      };
    }
    
    // 3. STRONG DOWNTREND + RSI NOT OVERSOLD → MARKET SELL (momentum)
    if (trendBias === "STRONG DOWNTREND" && rsi > 40 && rsi < 60) {
      return {
        orderType: "MARKET_SELL",
        entryPrice: currentPrice,
        reason: `Strong downtrend with RSI at ${rsi}. Enter immediately to ride momentum.`,
        confidence: 75,
      };
    }
    
    // 4. BREAKDOWN BELOW SUPPORT → SELL STOP
    if (distanceToSupport < atrThreshold && trendBias.includes("DOWNTREND")) {
      return {
        orderType: "SELL_STOP",
        entryPrice: supportLevel - atr * 0.2,
        reason: `Price approaching support (${supportLevel}). Sell stop below support to catch breakdown.`,
        confidence: 70,
      };
    }
    
    // 5. RSI OVERBOUGHT → MARKET SELL (reversal)
    if (rsi > 70) {
      return {
        orderType: "MARKET_SELL",
        entryPrice: currentPrice,
        reason: `RSI overbought at ${rsi}. Strong bearish reversal expected. Enter at market.`,
        confidence: 65,
      };
    }
    
    // 6. DEFAULT → SELL LIMIT at resistance
    return {
      orderType: "SELL_LIMIT",
      entryPrice: resistanceLevel,
      reason: `Sell limit at resistance (${resistanceLevel}) for best risk/reward ratio.`,
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
    "MARKET_BUY": "Market Buy - Enter immediately at current market price",
    "MARKET_SELL": "Market Sell - Enter immediately at current market price",
  };
  return descriptions[orderType] || "Unknown order type";
}