import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateSignalLevels, getExnessSpread, getLivePrice } from "@/lib/forex-data";

function buildAnalysis(pair: string, timeframe: string, signal: any): string {
  const rsiStatus = signal.rsi > 70 ? "OVERBOUGHT" : signal.rsi < 30 ? "OVERSOLD" : "NEUTRAL";

  if (signal.direction === "neutral") {
    return `📊 **TradeVault AI — ${pair} (${timeframe})**

⏸️ **NEUTRAL — No trade**

Conflicting signals on ${pair} (${timeframe}).
Current Price: ${signal.currentPrice}
Trend: ${signal.trendBias}
RSI: ${signal.rsi} (${rsiStatus})

⚠️ Wait for a clearer setup.`;
  }

  const dir = signal.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)";
  const emoji = signal.direction === "long" ? "📈" : "📉";

  return `📊 **TradeVault AI — ${pair} (${timeframe})**

${emoji} **Direction: ${dir}**
📋 Order Type: ${signal.orderTypeDescription}

━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Live Price: ${signal.currentPrice}
📊 Trend: ${signal.trendBias}
📉 RSI: ${signal.rsi} (${rsiStatus})
🕐 Session: ${signal.session}

━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY: ${signal.entryPrice}**
🛑 **STOP LOSS: ${signal.stopLossPrice}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1Price}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2Price}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3Price}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence} (${signal.signalScore}/100)**`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    let pair = "EUR/USD";
    let timeframe = "1H";
    let userPrice: string | null = null;

    // Support both JSON and FormData (for backward compatibility)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      pair = body.pair || "EUR/USD";
      timeframe = body.timeframe || "1H";
      userPrice = body.userPrice || null;
    } else {
      const formData = await request.formData();
      pair = (formData.get("pair") as string) || "EUR/USD";
      timeframe = (formData.get("timeframe") as string) || "1H";
      userPrice = formData.get("userPrice") as string;
    }

    // Get current price
    let currentPrice: number;
    if (userPrice && !isNaN(Number(userPrice)) && Number(userPrice) > 0) {
      currentPrice = Number(userPrice);
    } else {
      currentPrice = await getLivePrice(pair, timeframe);
    }

    // Generate signal from real candle data
    const signal = await generateSignalLevels(pair, currentPrice, timeframe);
    const spread = getExnessSpread(pair);
    const analysis = buildAnalysis(pair, timeframe, signal);

    return NextResponse.json({
      analysis,
      signal: {
        direction: signal.direction,
        orderType: signal.orderType,
        orderTypeDescription: signal.orderTypeDescription,
        orderRecommendation: signal.orderRecommendation,
        currentPrice: signal.currentPrice,
        entryPrice: signal.entry,
        stopLossPrice: signal.stopLoss,
        takeProfit1Price: signal.takeProfit1,
        takeProfit2Price: signal.takeProfit2,
        takeProfit3Price: signal.takeProfit3,
        stopLoss: `${signal.stopLoss} (${signal.riskPips} pips)`,
        takeProfit1: `${signal.takeProfit1} (${signal.rewardPips1} pips)`,
        takeProfit2: `${signal.takeProfit2} (${signal.rewardPips2} pips)`,
        takeProfit3: `${signal.takeProfit3} (${signal.rewardPips3} pips)`,
        riskReward1: signal.riskReward1,
        riskReward2: signal.riskReward2,
        riskReward3: signal.riskReward3,
        confidence: signal.confidence,
        confidenceScore: signal.confidenceScore,
        signalScore: signal.signalScore,
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
        multiTimeframeConsensus: signal.multiTimeframeConsensus,
        multiTimeframeStrength: signal.multiTimeframeStrength,
        confluences: signal.confluences,
        patterns: signal.patterns,
        chartPatterns: signal.chartPatterns,
        supplyDemandZones: signal.supplyDemandZones,
        backtest: signal.backtest,
        dataSource: signal.dataSource,
      },
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}