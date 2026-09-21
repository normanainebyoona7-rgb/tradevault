// src/app/api/analyze-chart/route.ts
// Analyze chart endpoint — Dukascopy data + zone-strategy + confluence.
// Response shape preserved for backward compatibility with the admin UI.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCandles } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { buildSignal } from "@/lib/signal";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const pair = body.pair || "EUR/USD";
    const timeframe = body.timeframe || "1H";

    // Fetch candles from Dukascopy
    const candles = await getCandles(pair, timeframe, 300);

    if (candles.length === 0) {
      return NextResponse.json(
        {
          error: "No market data",
          message: `Could not fetch candles for ${pair} ${timeframe}. Try another pair or timeframe.`,
        },
        { status: 400 },
      );
    }

    // Compute all overlays (zones, OB, FVG, indicators)
    const overlays = computeOverlays(pair, candles);

    // Build signal via zone-strategy + confluence
    const signal = buildSignal(pair, timeframe, candles, overlays);

    const currentPrice = candles[candles.length - 1].close;

    // ===== NEUTRAL PATH =====
    if (signal.direction === "neutral") {
      return NextResponse.json({
        status: signal.orderType === "limit" ? "watching" : "no_setup",
        message: signal.neutralReason || "No setup",
        analysis: signal.neutralReason || "No setup",
        signal: {
          direction: "neutral",
          orderType: "NONE",
          orderTypeDescription:
            signal.orderType === "limit"
              ? "Waiting for zone"
              : "No setup",

          currentPrice,
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
          dataSource: "dukascopy",
          status: signal.orderType === "limit" ? "watching" : "no_setup",

          zone: signal.zone,
          entrySignal: signal.entryCandle,
          confluences: signal.notes,
          candleCount: candles.length,
        },
      });
    }

    // ===== SIGNAL PATH =====

    // ---- Compatibility fields for the admin UI ----

    // Fibonacci from zone swing
    const swingStart =
      signal.zone?.type === "demand"
        ? signal.zone.bottom
        : signal.zone?.top ?? currentPrice;
    const swingEnd =
      signal.zone?.type === "demand"
        ? signal.zone.top
        : signal.zone?.bottom ?? currentPrice;
    const swingRange = Math.abs(swingEnd - swingStart);
    const isLong = signal.direction === "long";
    const fibDirection = isLong ? 1 : -1;

    const fibonacci = {
      swingStart,
      swingEnd,
      swingRange,
      ext_1_272: swingEnd + fibDirection * swingRange * 0.272,
      ext_1_618: swingEnd + fibDirection * swingRange * 0.618,
      ext_2_0: swingEnd + fibDirection * swingRange * 1.0,
      ret_0_236: swingEnd - fibDirection * swingRange * 0.236,
    };

    // Position sizing (1% risk on $10,000 account)
    const accountSize = 10000;
    const riskPercent = 1.0;
    const riskDollars = (accountSize * riskPercent) / 100;
    const quote = pair.split("/")[1] ?? "";
    const pipValuePerLot = pair.includes("XAU")
      ? 10
      : pair.includes("XAG")
        ? 50
        : pair.includes("BTC")
          ? 1
          : pair.includes("ETH")
            ? 1
            : quote === "JPY"
              ? 9.5
              : 10;

    const lots =
      signal.riskPips > 0
        ? Number((riskDollars / (signal.riskPips * pipValuePerLot)).toFixed(3))
        : 0;

    const positionSizing = {
      accountSize,
      riskPercent,
      riskDollars: Number(riskDollars.toFixed(2)),
      stopDistancePips: signal.riskPips,
      pipValuePerLot,
      lots,
    };

    // Session weight
    const sessionWeight =
      signal.confluences.session === "LONDON-NY OVERLAP"
        ? "Highest liquidity — best setups"
        : signal.confluences.session === "LONDON"
          ? "High liquidity — strong setups"
          : signal.confluences.session === "NEW YORK"
            ? "High liquidity — strong setups"
            : signal.confluences.session === "ASIAN"
              ? "Lower volatility — weaker setups"
              : "Reduced liquidity";

    // MTF note
    const mtfNote = `HTF confluence — OB: ${
      signal.confluences.orderBlockNear ? "✅" : "❌"
    }, FVG: ${signal.confluences.fvgNear ? "✅" : "❌"}`;

    // Round number note
    const roundNumberNote = signal.confluences.roundNumber
      ? "Near a round number level"
      : undefined;

    // Trade management notes
    const tradeManagement: string[] = [];
    if (isLong) {
      const beTrigger = signal.zone?.top ?? 0;
      tradeManagement.push(
        `Move SL to BE once price closes above ${beTrigger.toFixed(5)}`
      );
      tradeManagement.push(
        "Trail SL under new bullish large range candles"
      );
      tradeManagement.push(
        "Add position only at next demand zone if BE or better"
      );
    } else {
      const beTrigger = signal.zone?.bottom ?? 0;
      tradeManagement.push(
        `Move SL to BE once price closes below ${beTrigger.toFixed(5)}`
      );
      tradeManagement.push(
        "Trail SL above new bearish large range candles"
      );
      tradeManagement.push(
        "Add position only at next supply zone if BE or better"
      );
    }

    // ---- Analysis text ----
    const dirEmoji = signal.direction === "long" ? "📈" : "📉";
    const dirLabel = signal.signalLabel;

    const analysisText = `🎯 **Supply/Demand Signal — ${pair} (${timeframe})**

${dirEmoji} **${dirLabel}**

📍 **ZONE:** ${signal.zone?.type.toUpperCase()} ${signal.zone?.bottom.toFixed(
      5
    )} - ${signal.zone?.top.toFixed(5)}

🎯 **ENTRY:** ${signal.entry?.toFixed(5)}
🛑 **STOP LOSS:** ${signal.stopLoss?.toFixed(5)}
✅ **TP1:** ${signal.takeProfit1?.toFixed(5)}
✅ **TP2:** ${signal.takeProfit2?.toFixed(5)}
✅ **TP3:** ${signal.takeProfit3?.toFixed(5)}

⚡ Confidence: ${signal.confidence} (${signal.score}/100)
📊 R:R = 1:${signal.riskReward[0]} / 1:${signal.riskReward[1]} / 1:${signal.riskReward[2]}`;

    // ---- Order type for UI ----
    let uiOrderType: string;
    let uiOrderDesc: string;

    if (signal.orderType === "market") {
      uiOrderType =
        signal.direction === "long" ? "MARKET_BUY" : "MARKET_SELL";
      uiOrderDesc =
        signal.direction === "long"
          ? "Market Buy — enter at zone"
          : "Market Sell — enter at zone";
    } else {
      uiOrderType =
        signal.direction === "long" ? "BUY_LIMIT" : "SELL_LIMIT";
      uiOrderDesc =
        signal.direction === "long"
          ? "Buy Limit — place order at zone"
          : "Sell Limit — place order at zone";
    }

    return NextResponse.json({
      status: "signal",
      analysis: analysisText,
      signal: {
        direction: signal.direction,
        orderType: uiOrderType,
        orderTypeDescription: uiOrderDesc,

        currentPrice,
        entryPrice: signal.entry,
        stopLossPrice: signal.stopLoss,
        takeProfit1Price: signal.takeProfit1,
        takeProfit2Price: signal.takeProfit2,
        takeProfit3Price: signal.takeProfit3,

        riskPips: signal.riskPips,
        rewardPips1: signal.rewardPips[0],
        rewardPips2: signal.rewardPips[1],
        rewardPips3: signal.rewardPips[2],

        riskReward1: signal.riskReward[0],
        riskReward2: signal.riskReward[1],
        riskReward3: signal.riskReward[2],

        confidence: signal.confidence,
        confidenceScore: signal.score,
        signalScore: signal.score,

        timeframe,
        dataSource: "dukascopy",
        status: "signal",

        zone: signal.zone,
        entrySignal: signal.entryCandle,
        confluences: signal.notes,
        candleCount: candles.length,
        confluenceBreakdown: signal.confluences,

        // Compatibility fields for the admin UI
        fibonacci,
        positionSizing,
        mtfNote,
        session: signal.confluences.session,
        sessionWeight,
        roundNumberNote,
        tradeManagement,
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