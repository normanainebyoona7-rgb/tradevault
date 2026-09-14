import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildSMCSignal, SMCCandle } from "@/lib/smc-analysis";

async function fetchCandlesFromPython(
  pair: string,
  timeframe: string,
): Promise<SMCCandle[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/smc-candles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 200 }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[SMC] Python candles failed: ${response.status} ${err}`);
      return null;
    }

    const data = await response.json();
    if (!data.candles || data.candles.length < 20) {
      console.error(`[SMC] Only ${data.candles?.length || 0} candles returned`);
      return null;
    }

    console.log(`[SMC] Got ${data.candles.length} candles for ${pair} ${timeframe}`);
    return data.candles as SMCCandle[];
  } catch (error: any) {
    console.error(`[SMC] Fetch failed: ${error?.message}`);
    return null;
  }
}

function buildAnalysisText(pair: string, signal: any, timeframe: string): string {
  if (signal.direction === "neutral") {
    return `📊 **TradeVault SMC — ${pair} (${timeframe})**

⏸️ **NEUTRAL — No trade**

${signal.confluences.map((c: string) => `• ${c}`).join("\n")}

⚠️ No clean SMC setup detected.`;
  }

  const dir = signal.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)";
  const emoji = signal.direction === "long" ? "📈" : "📉";

  return `📊 **TradeVault SMC — ${pair} (${timeframe})**

${emoji} **Direction: ${dir}**

🎯 **ENTRY: ${signal.entryPrice}**
🛑 **STOP LOSS: ${signal.stopLossPrice}**
✅ **TP1: ${signal.takeProfit1Price}**
✅ **TP2: ${signal.takeProfit2Price}**
✅ **TP3: ${signal.takeProfit3Price}**

⚡ Confidence: ${signal.confidence} (${signal.signalScore}/100)`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const pair = body.pair || "XAU/USD";
    const timeframe = body.timeframe || "1H";

    // Fetch real candles from FCS via Python
    const candles = await fetchCandlesFromPython(pair, timeframe);

    if (!candles) {
      return NextResponse.json(
        {
          error: "No market data",
          message: `Could not fetch candles for ${pair} ${timeframe}. Try another pair or timeframe.`,
        },
        { status: 400 },
      );
    }

    // Build SMC signal
    const signal = buildSMCSignal(pair, candles);

    if (!signal) {
      return NextResponse.json(
        {
          error: "Not enough data",
          message: "Not enough candles to analyze.",
        },
        { status: 400 },
      );
    }

    const analysisText = buildAnalysisText(pair, {
      direction: signal.direction,
      confluences: signal.confluences,
      entryPrice: signal.entry,
      stopLossPrice: signal.stopLoss,
      takeProfit1Price: signal.takeProfit1,
      takeProfit2Price: signal.takeProfit2,
      takeProfit3Price: signal.takeProfit3,
      confidence: signal.confidence,
      signalScore: signal.score,
    }, timeframe);

    console.log(`[SMC Signal] ${pair} ${timeframe}: dir=${signal.direction} score=${signal.score}`);

    return NextResponse.json({
      analysis: analysisText,
      signal: {
        direction: signal.direction,
        orderType: signal.direction === "long" ? "MARKET_BUY" : signal.direction === "short" ? "MARKET_SELL" : "NONE",
        orderTypeDescription:
          signal.direction === "long"
            ? "Market Buy — enter immediately"
            : signal.direction === "short"
            ? "Market Sell — enter immediately"
            : "No trade",

        currentPrice: signal.entry,
        entryPrice: signal.entry,
        stopLossPrice: signal.stopLoss,
        takeProfit1Price: signal.takeProfit1,
        takeProfit2Price: signal.takeProfit2,
        takeProfit3Price: signal.takeProfit3,

        riskPips: signal.riskPips,
        rewardPips1: signal.rewardPips1,
        rewardPips2: signal.rewardPips2,
        rewardPips3: signal.rewardPips3,

        riskReward1: signal.riskReward1,
        riskReward2: signal.riskReward2,
        riskReward3: signal.riskReward3,

        confidence: signal.confidence,
        confidenceScore: signal.score,
        signalScore: signal.score,

        timeframe,
        dataSource: signal.smcSource,

        confluences: signal.confluences,
        liquidityZones: signal.liquidityZones,
        orderBlocks: signal.orderBlocks,
        fvgs: signal.fvgs,
        candleCount: signal.candleCount,
      },
    });
  } catch (error: any) {
    console.error("Analyze-chart error:", error);
    return NextResponse.json(
      { error: "Analysis failed", message: error?.message || String(error) },
      { status: 500 },
    );
  }
}