import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildSMCSignal, SMCCandle } from "@/lib/smc-analysis";

async function fetchCandlesFromPython(
  pair: string,
  timeframe: string,
  limit: number = 300,
): Promise<SMCCandle[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/smc-candles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.error(`[SMC] Python failed: ${response.status} for ${pair} ${timeframe}`);
      return null;
    }

    const data = await response.json();
    if (!data.candles || data.candles.length < 50) {
      console.error(`[SMC] Only ${data.candles?.length || 0} candles for ${pair} ${timeframe}`);
      return null;
    }

    console.log(`[SMC] Got ${data.candles.length} candles for ${pair} ${timeframe}`);
    return data.candles as SMCCandle[];
  } catch (error: any) {
    console.error(`[SMC] Fetch failed for ${pair} ${timeframe}: ${error?.message}`);
    return null;
  }
}

async function fetchMTFCandles(
  pair: string,
  timeframe: string,
): Promise<SMCCandle[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/smc-candles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 100 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[MTF ${timeframe}] Python failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.candles || data.candles.length < 10) {
      console.error(`[MTF ${timeframe}] Only ${data.candles?.length || 0} candles`);
      return null;
    }

    console.log(`[MTF ${timeframe}] Got ${data.candles.length} candles`);
    return data.candles as SMCCandle[];
  } catch (error: any) {
    console.error(`[MTF ${timeframe}] Failed: ${error?.message}`);
    return null;
  }
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

    // Fetch main candles + MTF (M5, M15) in parallel
    const [candles, mtf5, mtf15] = await Promise.all([
      fetchCandlesFromPython(pair, timeframe, 300),
      fetchMTFCandles(pair, "5m"),
      fetchMTFCandles(pair, "15m"),
    ]);

    if (!candles) {
      return NextResponse.json(
        {
          error: "No market data",
          message: `Could not fetch candles for ${pair} ${timeframe}. Try another pair or timeframe.`,
        },
        { status: 400 },
      );
    }

    const signal = buildSMCSignal(pair, candles, mtf5, mtf15);

    if (!signal) {
      return NextResponse.json(
        { error: "Not enough data", message: "Need at least 50 candles." },
        { status: 400 },
      );
    }

    const dirEmoji = signal.direction === "long" ? "📈" : "📉";
    const dirLabel = signal.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)";

    const analysisText = `📊 **TradeVault SMC — ${pair} (${timeframe})**

${dirEmoji} **Direction: ${dirLabel}**

🎯 **ENTRY: ${signal.entry}**
🛑 **STOP LOSS: ${signal.stopLoss}**
✅ **TP1: ${signal.takeProfit1}**
✅ **TP2: ${signal.takeProfit2}**
✅ **TP3: ${signal.takeProfit3}**

⚡ Confidence: ${signal.confidence} (${signal.score}/100)
⏱️ MTF: ${signal.mtfAlignment}`;

    console.log(`[SMC Signal] ${pair} ${timeframe}: dir=${signal.direction} score=${signal.score} mtf=${signal.mtfAlignment}`);

    return NextResponse.json({
      analysis: analysisText,
      signal: {
        direction: signal.direction,
        orderType: signal.direction === "long" ? "MARKET_BUY" : "MARKET_SELL",
        orderTypeDescription:
          signal.direction === "long"
            ? "Market Buy — enter immediately"
            : "Market Sell — enter immediately",

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
        supplyDemandZones: signal.supplyDemandZones,
        sma9: signal.sma9,
        sma21: signal.sma21,
        sma200: signal.sma200,
        candleCount: signal.candleCount,
        mtf5: signal.mtf5,
        mtf15: signal.mtf15,
        mtfAlignment: signal.mtfAlignment,
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