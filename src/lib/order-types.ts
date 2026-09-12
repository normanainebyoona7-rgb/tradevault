// src/lib/order-types.ts

export type OrderType = "MARKET_BUY" | "MARKET_SELL";

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
  if (direction === "long") {
    return {
      orderType: "MARKET_BUY",
      entryPrice: currentPrice,
      reason: `Enter BUY immediately at market price ${currentPrice.toFixed(5)}.`,
      confidence: 80,
    };
  } else {
    return {
      orderType: "MARKET_SELL",
      entryPrice: currentPrice,
      reason: `Enter SELL immediately at market price ${currentPrice.toFixed(5)}.`,
      confidence: 80,
    };
  }
}

export function getOrderTypeDescription(orderType: OrderType): string {
  const descriptions: Record<OrderType, string> = {
    "MARKET_BUY": "MARKET BUY - Enter immediately at current price",
    "MARKET_SELL": "MARKET SELL - Enter immediately at current price",
  };
  return descriptions[orderType] || "Unknown order type";
}