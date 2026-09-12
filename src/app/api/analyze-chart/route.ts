import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateSignalLevels, getExnessSpread, getLivePrice, ImageLevels } from "@/lib/forex-data";

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

${signal.imageLevels ? `📸 **Analyzed from chart image:**
   • Support levels: ${signal.imageLevels.support.length}
   • Resistance levels: ${signal.imageLevels.resistance.length}
   • Detected trend: ${signal.imageLevels.trend}` : `📡 Live data analysis`}

━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY: ${signal.entryPrice}**
🛑 **STOP LOSS: ${signal.stopLossPrice}** (${signal.riskPips} pips)
✅ **TP1: ${signal.takeProfit1Price}** (R:R 1:${signal.riskReward1})
✅ **TP2: ${signal.takeProfit2Price}** (R:R 1:${signal.riskReward2})
✅ **TP3: ${signal.takeProfit3Price}** (R:R 1:${signal.riskReward3})

⚡ **CONFIDENCE: ${signal.confidence} (${signal.signalScore}/100)**`;
}

async function analyzeImageWithPython(file: File): Promise<ImageLevels | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${pythonUrl}/api/analyze-image`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`Python image analysis failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== "success") {
      console.error(`Python returned error: ${data.message}`);
      return null;
    }

    return {
      support: data.support_levels || [],
      resistance: data.resistance_levels || [],
      yMin: data.y_axis_range?.min || 0,
      yMax: data.y_axis_range?.max || 0,
      trend: data.trend?.bias || "NEUTRAL",
      greenPct: data.trend?.green_pct || 50,
    };
  } catch (error: any) {
    console.error(`Image analysis error: ${error?.message}`);
    return null;
  }
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

    // 1. Analyze the uploaded image via Python
    const imageLevels = await analyzeImageWithPython(file);
    if (imageLevels) {
      console.log(`[Image] ${pair}: ${imageLevels.support.length} support, ${imageLevels.resistance.length} resistance, trend=${imageLevels.trend}`);
    } else {
      console.log(`[Image] No levels extracted — falling back to ATR-based analysis`);
    }

    // 2. Get current price
    let currentPrice: number;
    if (userPrice && !isNaN(Number(userPrice)) && Number(userPrice) > 0) {
      currentPrice = Number(userPrice);
    } else {
      currentPrice = await getLivePrice(pair, timeframe);
    }

    // 3. Generate signal — image levels drive SL/TP placement
    const signal = await generateSignalLevels(pair, currentPrice, timeframe, imageLevels);
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
        imageLevels: signal.imageLevels,
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