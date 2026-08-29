import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateSignalLevels, getExnessSpread, getLivePrice } from "@/lib/forex-data";

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
📋 **Order Type: ${signal.orderTypeDescription}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **ANALYSIS:**

1. **Live Price: ${signal.currentPrice}**
   • Real-time ${timeframe} market data

2. **Trend: ${signal.trendBias}**
   • MA20 (${signal.ma20}) vs MA50 (${signal.ma50})
   • ${signal.ma20 > signal.ma50 ? "Bullish: MA20 above MA50" : "Bearish: MA20 below MA50"}

3. **RSI (${signal.rsi}):**
   • Status: ${rsiStatus}

4. **Session: ${signal.session}**
   • ${signal.sessionAnalysis}

5. **Chart Patterns Detected:**
   • ${signal.chartPatterns?.length > 0 ? signal.chartPatterns.map((p: any) => p.name).join(", ") : "No major patterns"}

6. **Supply/Demand Zones:**
   • ${signal.supplyDemandZones?.length > 0 ? signal.supplyDemandZones.map((z: any) => `${z.type.toUpperCase()} at ${z.bottom}-${z.top}`).join(", ") : "No key zones"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY (${signal.orderType}): ${signal.entry}**
🛑 **STOP LOSS: ${signal.stopLoss}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence} (${signal.signalScore}/100)**`;
  }

  return `📊 **TradeVault AI Analysis — ${pair} (${timeframe})**

📉 **Direction: SELL (SHORT)**
📋 **Order Type: ${signal.orderTypeDescription}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **ANALYSIS:**

1. **Live Price: ${signal.currentPrice}**
   • Real-time ${timeframe} market data

2. **Trend: ${signal.trendBias}**
   • MA20 (${signal.ma20}) vs MA50 (${signal.ma50})
   • ${signal.ma20 < signal.ma50 ? "Bearish: MA20 below MA50" : "Bullish: MA20 above MA50"}

3. **RSI (${signal.rsi}):**
   • Status: ${rsiStatus}

4. **Session: ${signal.session}**
   • ${signal.sessionAnalysis}

5. **Chart Patterns Detected:**
   • ${signal.chartPatterns?.length > 0 ? signal.chartPatterns.map((p: any) => p.name).join(", ") : "No major patterns"}

6. **Supply/Demand Zones:**
   • ${signal.supplyDemandZones?.length > 0 ? signal.supplyDemandZones.map((z: any) => `${z.type.toUpperCase()} at ${z.bottom}-${z.top}`).join(", ") : "No key zones"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY (${signal.orderType}): ${signal.entry}**
🛑 **STOP LOSS: ${signal.stopLoss}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence} (${signal.signalScore}/100)**`;
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

    // Priority 1: User manually entered price
    if (userPrice && !isNaN(Number(userPrice)) && Number(userPrice) > 0) {
      currentPrice = Number(userPrice);
      console.log(`Using user price for ${pair}: ${currentPrice}`);
    } else {
      // Priority 2: Fetch live price using selected timeframe
      currentPrice = await getLivePrice(pair, timeframe);
      console.log(`Live price for ${pair} (${timeframe}): ${currentPrice}`);
    }

    // Generate signal with real market data using selected timeframe
    const signal = await generateSignalLevels(pair, currentPrice, timeframe);
    const spread = getExnessSpread(pair);

    const analysis = generateProfessionalAnalysis(pair, timeframe, signal, spread);

    return NextResponse.json({
      analysis,
      signal: {
        direction: signal.direction,
        orderType: signal.orderType,
        orderTypeDescription: signal.orderTypeDescription,
        orderRecommendation: signal.orderRecommendation,
        entryZone: `${signal.entry}`,
        stopLoss: `${signal.stopLoss} (${signal.riskPips} pips)`,
        takeProfit1: `${signal.takeProfit1} (${signal.rewardPips1} pips)`,
        takeProfit2: `${signal.takeProfit2} (${signal.rewardPips2} pips)`,
        takeProfit3: `${signal.takeProfit3} (${signal.rewardPips3} pips)`,
        riskReward: `1:${signal.riskReward1} to 1:${signal.riskReward3}`,
        confidence: signal.confidence,
        confidenceScore: signal.signalScore,
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
        macd: signal.macd,
        macdSignal: signal.macdSignal,
        macdHistogram: signal.macdHistogram,
        bollingerUpper: signal.bollingerUpper,
        bollingerLower: signal.bollingerLower,
        session: signal.session,
        sessionAnalysis: signal.sessionAnalysis,
        signalScore: signal.signalScore,
        multiTimeframeConsensus: signal.multiTimeframeConsensus,
        multiTimeframeStrength: signal.multiTimeframeStrength,
        confluences: signal.confluences,
        patterns: signal.patterns,
        chartPatterns: signal.chartPatterns,
        supplyDemandZones: signal.supplyDemandZones,
        backtest: signal.backtest,
        dataSource: "Yahoo Finance Live Data",
      },
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}