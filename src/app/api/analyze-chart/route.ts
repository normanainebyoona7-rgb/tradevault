import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildSMCSignal, PythonSMCResponse } from "@/lib/smc-from-image";

async function analyzeImageWithPython(file: File): Promise<PythonSMCResponse | null> {
  try {
    const pythonUrl = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const formData = new FormData();
    formData.append("file", file);

    console.log(`[SMC] Sending image to Python for SMC extraction...`);

    const response = await fetch(`${pythonUrl}/api/analyze-image`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(45000), // Python OCR takes time
    });

    if (!response.ok) {
      console.error(`[SMC] Python returned ${response.status}`);
      return null;
    }

    const data: PythonSMCResponse = await response.json();

    if (data.status !== "success") {
      console.error(`[SMC] Python error: ${data.message}`);
      return null;
    }

    console.log(`[SMC] Python returned ${data.candle_count} candles, ${data.liquidity?.length || 0} liquidity zones, ${data.order_blocks?.length || 0} OBs, ${data.fvgs?.length || 0} FVGs`);

    return data;
  } catch (error: any) {
    console.error(`[SMC] Image analysis failed: ${error?.message}`);
    return null;
  }
}

function buildAnalysisText(pair: string, signal: any, timeframe: string): string {
  if (signal.direction === "neutral") {
    return `📊 **TradeVault SMC — ${pair} (${timeframe})**

⏸️ **NEUTRAL — No trade**

${signal.confluences.map((c: string) => `• ${c}`).join("\n")}

⚠️ No clean SMC setup detected. Try another pair or timeframe.`;
  }

  const dir = signal.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)";
  const emoji = signal.direction === "long" ? "📈" : "📉";

  return `📊 **TradeVault SMC — ${pair} (${timeframe})**

${emoji} **Direction: ${dir}**

━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **ENTRY: ${signal.entryPrice}**
🛑 **STOP LOSS: ${signal.stopLossPrice}**
✅ **TP1: ${signal.takeProfit1Price}**
✅ **TP2: ${signal.takeProfit2Price}**
✅ **TP3: ${signal.takeProfit3Price}**

⚡ **Confidence: ${signal.confidence} (${signal.signalScore}/100)**`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    let pair = "XAU/USD";
    let timeframe = "1H";
    let userPrice: string | null = null;
    let file: File | null = null;

    // Support both JSON (no image) and FormData (with image)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      pair = body.pair || "XAU/USD";
      timeframe = body.timeframe || "1H";
      userPrice = body.userPrice || null;
    } else {
      const formData = await request.formData();
      pair = (formData.get("pair") as string) || "XAU/USD";
      timeframe = (formData.get("timeframe") as string) || "1H";
      userPrice = formData.get("userPrice") as string;
      file = formData.get("file") as File | null;
    }

    // ==== REQUIRE IMAGE ====
    if (!file || file.size === 0) {
      return NextResponse.json(
        {
          error: "Chart screenshot required",
          message: "Please upload a chart screenshot for SMC analysis.",
        },
        { status: 400 }
      );
    }

    // ==== STEP 1: Python extracts SMC data from image ====
    const pythonResponse = await analyzeImageWithPython(file);

    if (!pythonResponse || pythonResponse.status !== "success") {
      return NextResponse.json(
        {
          error: "Image analysis failed",
          message:
            pythonResponse?.message ||
            "Could not read the chart. Please upload a clearer screenshot with a visible price scale.",
        },
        { status: 400 }
      );
    }

    // ==== STEP 2: Build SMC signal from Python data ====
    const signal = buildSMCSignal(pair, pythonResponse);

    if (!signal) {
      return NextResponse.json(
        {
          error: "Signal generation failed",
          message: "Not enough candles detected for SMC analysis.",
        },
        { status: 400 }
      );
    }

    // ==== STEP 3: Build analysis text ====
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

    // ==== STEP 4: Return full signal ====
    console.log(`[SMC Signal] ${pair} ${timeframe}: dir=${signal.direction} score=${signal.score} entry=${signal.entry.toFixed(5)} sl=${signal.stopLoss.toFixed(5)} tp1=${signal.takeProfit1.toFixed(5)} rr1=1:${signal.riskReward1}`);

    return NextResponse.json({
      analysis: analysisText,
      signal: {
        // Core signal
        direction: signal.direction,
        orderType: signal.direction === "long" ? "MARKET_BUY" : signal.direction === "short" ? "MARKET_SELL" : "NONE",
        orderTypeDescription: signal.direction === "long" ? "Market Buy — enter immediately" : signal.direction === "short" ? "Market Sell — enter immediately" : "No trade",

        // Numeric levels
        currentPrice: signal.entry,
        entryPrice: signal.entry,
        stopLossPrice: signal.stopLoss,
        takeProfit1Price: signal.takeProfit1,
        takeProfit2Price: signal.takeProfit2,
        takeProfit3Price: signal.takeProfit3,

        // Pips
        riskPips: signal.riskPips,
        rewardPips1: signal.rewardPips1,
        rewardPips2: signal.rewardPips2,
        rewardPips3: signal.rewardPips3,

        // R:R
        riskReward1: signal.riskReward1,
        riskReward2: signal.riskReward2,
        riskReward3: signal.riskReward3,

        // Confidence
        confidence: signal.confidence,
        confidenceScore: signal.score,
        signalScore: signal.score,

        // Context
        timeframe,
        dataSource: signal.smcSource,

        // SMC specifics (admin-facing)
        confluences: signal.confluences,
        liquidityZones: signal.liquidityZones,
        orderBlocks: signal.orderBlocks,
        fvgs: signal.fvgs,
        candleCount: signal.candleCount,
        yAxisRange: signal.yAxisRange,
        slTpSource: signal.smcSource,
        slTpNotes: signal.confluences.filter(c => c.startsWith("🎯")),
      },
    });
  } catch (error: any) {
    console.error("Analyze-chart error:", error);
    return NextResponse.json(
      { error: "Analysis failed", message: error?.message || String(error) },
      { status: 500 }
    );
  }
}