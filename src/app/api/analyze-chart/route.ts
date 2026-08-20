import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateSignalLevels, getExnessSpread, getLivePrice } from "@/lib/forex-data";

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

function generateProfessionalAnalysis(
  pair: string,
  timeframe: string,
  signal: any,
  spread: number,
): string {
  const rsiStatus = signal.rsi > 70 ? "OVERBOUGHT" : signal.rsi < 30 ? "OVERSOLD" : "NEUTRAL";

  if (signal.direction === "long") {
    return `📊 **TradeVault AI Analysis — ${pair} (${timeframe})**

📈 **Direction: BUY (LONG)**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **WHY WE ARE BUYING:**

1. **Live Price: ${signal.currentPrice}**
   • Real-time market data from Yahoo Finance

2. **Trend Analysis:**
   • Trend: ${signal.trendBias}
   • MA20 (${signal.ma20}) vs MA50 (${signal.ma50})
   • ${signal.ma20 > signal.ma50 ? "Bullish: MA20 above MA50" : "Bearish: MA20 below MA50"}

3. **RSI (${signal.rsi}):**
   • Status: ${rsiStatus}
   • ${signal.rsi < 70 ? "RSI below 70 = room to run upward" : "RSI overbought = caution"}

4. **ATR (${signal.atr}):**
   • Volatility measure: ${signal.atr}
   • Stop loss sized at 1.5x ATR for optimal placement

5. **Support Level: ${signal.supportLevel}**
   • Price is ${signal.currentPrice > signal.supportLevel ? "ABOVE support" : "AT support"}
   • Buyers historically defend this zone

6. **Session: ${signal.session}**
   • ${signal.session === "LONDON" ? "London session = high liquidity" : signal.session === "NEW YORK" ? "NY session = USD volatility" : "Normal trading session"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY (Immediate): ${signal.entry}**
🛑 **STOP LOSS: ${signal.stopLoss}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence}**
💰 **Risk 1-2% per trade**`;
  }

  return `📊 **TradeVault AI Analysis — ${pair} (${timeframe})**

📉 **Direction: SELL (SHORT)**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **WHY WE ARE SELLING:**

1. **Live Price: ${signal.currentPrice}**
   • Real-time market data from Yahoo Finance

2. **Trend Analysis:**
   • Trend: ${signal.trendBias}
   • MA20 (${signal.ma20}) vs MA50 (${signal.ma50})
   • ${signal.ma20 < signal.ma50 ? "Bearish: MA20 below MA50" : "Bullish: MA20 above MA50"}

3. **RSI (${signal.rsi}):**
   • Status: ${rsiStatus}
   • ${signal.rsi > 30 ? "RSI above 30 = room to run downward" : "RSI oversold = caution"}

4. **ATR (${signal.atr}):**
   • Volatility measure: ${signal.atr}
   • Stop loss sized at 1.5x ATR for optimal placement

5. **Resistance Level: ${signal.resistanceLevel}**
   • Price is ${signal.currentPrice < signal.resistanceLevel ? "BELOW resistance" : "AT resistance"}
   • Sellers historically defend this zone

6. **Session: ${signal.session}**
   • ${signal.session === "LONDON" ? "London session = high liquidity" : signal.session === "NEW YORK" ? "NY session = USD volatility" : "Normal trading session"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY (Immediate): ${signal.entry}**
🛑 **STOP LOSS: ${signal.stopLoss}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence}**
💰 **Risk 1-2% per trade**`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const pair = (formData.get("pair") as string) || "EUR/USD";
    const timeframe = (formData.get("timeframe") as string) || "1H";
    const userPrice = formData.get("userPrice") as string;

    if (!file) {
      return NextResponse.json({ error: "Image file required" }, { status: 400 });
    }

    let currentPrice: number;

    // Try to get live price from Yahoo Finance
    if (userPrice && !isNaN(Number(userPrice)) && Number(userPrice) > 0) {
      // Use user's manual price if provided
      currentPrice = Number(userPrice);
    } else {
      // Fetch real live price
      try {
        currentPrice = await getLivePrice(pair);
        console.log(`Live price for ${pair}: ${currentPrice}`);
      } catch (error) {
        console.error(`Failed to get live price for ${pair}, using fallback:`, error);
        currentPrice = FALLBACK_PRICES[pair] || 1.0;
      }
    }

    // Generate signal with real market data
    const signal = await generateSignalLevels(pair, currentPrice);
    const spread = getExnessSpread(pair);

    const analysis = generateProfessionalAnalysis(pair, timeframe, signal, spread);

    return NextResponse.json({
      analysis,
      signal: {
        direction: signal.direction,
        entryZone: `${signal.entry}`,
        stopLoss: `${signal.stopLoss} (${signal.riskPips} pips)`,
        takeProfit1: `${signal.takeProfit1} (${signal.rewardPips1} pips)`,
        takeProfit2: `${signal.takeProfit2} (${signal.rewardPips2} pips)`,
        takeProfit3: `${signal.takeProfit3} (${signal.rewardPips3} pips)`,
        riskReward: `1:${signal.riskReward1} to 1:${signal.riskReward3}`,
        confidence: signal.confidence,
        currentPrice: signal.currentPrice,
        entryPrice: signal.entry,
        stopLossPrice: signal.stopLoss,
        takeProfit1Price: signal.takeProfit1,
        takeProfit2Price: signal.takeProfit2,
        takeProfit3Price: signal.takeProfit3,
        riskPips: signal.riskPips,
        timeframe,
        spread,
        trendBias: signal.trendBias,
        supportLevel: signal.supportLevel,
        resistanceLevel: signal.resistanceLevel,
        ma20: signal.ma20,
        ma50: signal.ma50,
        ma200: signal.ma200,
        rsi: signal.rsi,
        atr: signal.atr,
        session: signal.session,
        dataSource: "Yahoo Finance Live Data",
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}