import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { runZoneStrategy, ZoneCandle } from "@/lib/zone-strategy";

async function fetchCandlesFromPython(
  pair: string,
  timeframe: string,
  limit: number = 300,
): Promise<ZoneCandle[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/smc-candles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.error(`[Zone] Python failed: ${response.status} for ${pair} ${timeframe}`);
      return null;
    }

    const data = await response.json();
    if (!data.candles || data.candles.length < 50) {
      console.error(`[Zone] Only ${data.candles?.length || 0} candles for ${pair} ${timeframe}`);
      return null;
    }

    console.log(`[Zone] Got ${data.candles.length} candles for ${pair} ${timeframe}`);
    return data.candles as ZoneCandle[];
  } catch (error: any) {
    console.error(`[Zone] Fetch failed for ${pair} ${timeframe}: ${error?.message}`);
    return null;
  }
}

async function fetchMTFCandles(
  pair: string,
  timeframe: string,
): Promise<ZoneCandle[] | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const response = await fetch(`${pythonUrl}/api/smc-candles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 100 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.candles || data.candles.length < 10) return null;
    return data.candles as ZoneCandle[];
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

    const result = runZoneStrategy(pair, candles, mtf5, mtf15);

    console.log(`[Zone Signal] ${pair} ${timeframe}: status=${result.status}${result.direction ? " dir=" + result.direction : ""}`);

    // If no signal yet — return watching or no_setup
    if (result.status !== "signal") {
      return NextResponse.json({
        status: result.status,
        message: result.message,
        analysis: result.message,
        signal: {
          direction: "neutral",
          orderType: "NONE",
          orderTypeDescription: result.status === "watching" ? "Waiting for zone" : "No setup",

          currentPrice: candles[candles.length - 1].close,
          entryPrice: 0,
          stopLossPrice: 0,
          takeProfit1Price: 0,
          takeProfit2Price: 0,
          takeProfit3Price: 0,

          riskPips: 0,
          rewardPips1: 0,
          rewardPips2: 0,
          rewardPips3: 0,
          riskReward1: "0",
          riskReward2: "0",
          riskReward3: "0",

          confidence: "NEUTRAL",
          confidenceScore: 0,
          signalScore: 0,

          timeframe,
          dataSource: "live_data",
          status: result.status,

          zone: result.zone || null,
          entrySignal: result.entrySignal || null,
          confluences: result.confluences || [],
          candleCount: result.candleCount,
        },
      });
    }

    // ===== Valid signal =====
    const dirEmoji = result.direction === "long" ? "📈" : "📉";
    const dirLabel = result.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)";

    const analysisText = `🎯 **Zone Strategy — ${pair} (${timeframe})**

${dirEmoji} **Direction: ${dirLabel}**

📍 **ZONE:** ${result.zone?.type.toUpperCase()} ${result.zone?.bottom.toFixed(5)} - ${result.zone?.top.toFixed(5)}

🎯 **ENTRY:** ${result.entry?.toFixed(5)}
🛑 **STOP LOSS:** ${result.stopLoss?.toFixed(5)}
✅ **TP1 (1.272 Fib):** ${result.takeProfit1?.toFixed(5)}
✅ **TP2 (1.618 Fib):** ${result.takeProfit2?.toFixed(5)}
✅ **TP3 (2.0 Fib):** ${result.takeProfit3?.toFixed(5)}

⚡ Confidence: ${result.confidence} (${result.entrySignal?.probability}% base)
🕐 Session: ${result.session}
📊 R:R = 1:${result.riskReward1} / 1:${result.riskReward2} / 1:${result.riskReward3}`;

    return NextResponse.json({
      status: "signal",
      analysis: analysisText,
      signal: {
        direction: result.direction,
        orderType: result.direction === "long" ? "MARKET_BUY" : "MARKET_SELL",
        orderTypeDescription:
          result.direction === "long"
            ? "Market Buy — enter at zone"
            : "Market Sell — enter at zone",

        currentPrice: result.entry,
        entryPrice: result.entry,
        stopLossPrice: result.stopLoss,
        takeProfit1Price: result.takeProfit1,
        takeProfit2Price: result.takeProfit2,
        takeProfit3Price: result.takeProfit3,

        riskPips: result.riskPips,
        rewardPips1: result.rewardPips1,
        rewardPips2: result.rewardPips2,
        rewardPips3: result.rewardPips3,

        riskReward1: result.riskReward1,
        riskReward2: result.riskReward2,
        riskReward3: result.riskReward3,

        confidence: result.confidence,
        confidenceScore: result.entrySignal?.probability || 0,
        signalScore: result.entrySignal?.probability || 0,

        timeframe,
        dataSource: "live_data",
        status: "signal",

        // Zone data
        zone: result.zone,
        entrySignal: result.entrySignal,
        fibonacci: result.fibonacci,
        tradeManagement: result.tradeManagement,
        positionSizing: result.positionSizing,
        mtfConfirmed: result.mtfConfirmed,
        mtfNote: result.mtfNote,
        session: result.session,
        sessionWeight: result.sessionWeight,
        nearRoundNumber: result.nearRoundNumber,
        roundNumberNote: result.roundNumberNote,

        confluences: result.confluences,
        candleCount: result.candleCount,
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