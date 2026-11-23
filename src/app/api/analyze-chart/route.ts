// src/app/api/analyze-chart/route.ts
// Analyzes a live chart with cross-source price verification, ATR-based SL,
// Fibonacci TPs, and an SMC / ICT / supply-demand breakdown.
// Orders emitted: BUY, SELL, BUY LIMIT, SELL LIMIT — no NEUTRAL, no STOP orders.
//
// Tier gating: free = TP1 only, vip = TP1+TP2, vvip = TP1..TP4 + descriptions.
// Admins (by email) bypass tier gating and always get vvip access.
// Enforcement happens server-side via gateSignal() — locked TPs never leave.
//
// Admin kill switch + ban: if Config.aiEnabled === false -> 423;
// if the user is banned -> 403. Neither changes AI logic.
// Activity logging: writes an AnalysisEvent doc (best-effort; never throws).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCandles } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { buildSignal } from "@/lib/signal";
import { getVerifiedPrice } from "@/lib/analysis";
import {
  buildSMCSignal,
  type SMCCandle,
  type SMCSignal,
} from "@/lib/smc-analysis";
import { activeKillzone } from "@/lib/market-structure";
import type { Overlays } from "@/lib/overlays";
import { gateSignal, resolveTier } from "@/lib/subscription";
import { dbConnect } from "@/lib/db/mongodb";
import { getGlobalConfig } from "@/lib/models/config";
import AnalysisEvent from "@/lib/models/analysis-event";
import User from "@/lib/models/user";

function buildSmcPayload(
  pair: string,
  candles: SMCCandle[],
  overlays: Overlays
) {
  const smcSignal: SMCSignal | null =
    candles.length >= 50 ? buildSMCSignal(pair, candles) : null;

  return {
    direction: smcSignal?.direction ?? "neutral",
    score: smcSignal?.score ?? 0,
    confidence: smcSignal?.confidence ?? "NEUTRAL",
    confluences: (smcSignal?.confluences ?? []).map((line) =>
      line.replace(/^[^\p{L}\p{N}]+/u, "")
    ),
    entry: smcSignal?.entry ?? null,
    stopLoss: smcSignal?.stopLoss ?? null,
    takeProfit1: smcSignal?.takeProfit1 ?? null,
    takeProfit2: smcSignal?.takeProfit2 ?? null,
    takeProfit3: smcSignal?.takeProfit3 ?? null,
    liquidityZones: smcSignal?.liquidityZones ?? overlays.liquidityZones,
    orderBlocks: smcSignal?.orderBlocks ?? overlays.orderBlocks,
    fvgs: smcSignal?.fvgs ?? overlays.fvgs,
    supplyDemandZones: smcSignal?.supplyDemandZones ?? overlays.smcSupplyDemand,
    structure: overlays.structure,
    premiumDiscount: overlays.premiumDiscount,
    liquiditySweeps: overlays.liquiditySweeps,
    killzone: activeKillzone(),
  };
}

async function logAnalysisEvent(args: {
  session: any;
  pair: string;
  timeframe: string;
  direction: string;
  tier: string;
}) {
  try {
    await dbConnect();
    await AnalysisEvent.create({
      userEmail: String(args.session?.email ?? "unknown"),
      userName: String(args.session?.name ?? ""),
      pair: args.pair,
      timeframe: args.timeframe,
      direction: args.direction,
      tierAtTime: args.tier,
    });
  } catch (e) {
    console.error("AnalysisEvent log failed (non-fatal):", e);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- Admin kill switch + ban enforcement ----
    try {
      await dbConnect();
      const cfg = await getGlobalConfig();
      if (!cfg.aiEnabled) {
        return NextResponse.json(
          {
            error: "AI disabled",
            message:
              cfg.aiDisabledMessage ||
              "AI analysis is temporarily disabled by the administrator.",
          },
          { status: 423 }
        );
      }

      const user: any = await User.findOne({
        email: String((session as any)?.email ?? "").toLowerCase(),
      })
        .select("banned bannedReason")
        .lean();

      if (user?.banned) {
        return NextResponse.json(
          {
            error: "Account banned",
            message:
              user.bannedReason ||
              "Your account has been banned by the administrator.",
          },
          { status: 403 }
        );
      }
    } catch (e) {
      console.error("Config check failed (non-fatal):", e);
    }

    // Admins bypass tier gating — resolveTier returns "vvip" for admin email.
    const userTier = resolveTier(session as any);

    const body = await request.json();
    const pair = body.pair || "EUR/USD";
    const timeframe = body.timeframe || "1H";

    const candles = await getCandles(pair, timeframe, 300);

    if (candles.length === 0) {
      return NextResponse.json(
        {
          error: "No market data",
          message: `Could not fetch candles for ${pair} ${timeframe}.`,
        },
        { status: 400 },
      );
    }

    const currentPrice = candles[candles.length - 1].close;
    const verified = await getVerifiedPrice(pair, currentPrice);

    const overlays = computeOverlays(pair, candles);
    const signal = buildSignal(pair, timeframe, candles, overlays, verified);

    const smcCandles: SMCCandle[] = candles.map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      is_green: c.is_green,
    }));
    const smc = buildSmcPayload(pair, smcCandles, overlays);

    const isLong = signal.direction === "long";
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

    const accountSize = 10000;
    const riskPercent = 1.0;
    const riskDollars = (accountSize * riskPercent) / 100;
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

    const swingStart =
      signal.zone?.type === "demand"
        ? signal.zone.bottom
        : signal.zone?.top ?? currentPrice;
    const swingEnd =
      signal.zone?.type === "demand"
        ? signal.zone.top
        : signal.zone?.bottom ?? currentPrice;
    const swingRange = Math.abs(swingEnd - swingStart);
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

    const sessionWeight =
      signal.confluences.session === "LONDON-NY OVERLAP"
        ? "Highest liquidity"
        : signal.confluences.session === "LONDON" ||
            signal.confluences.session === "NEW YORK"
          ? "High liquidity"
          : signal.confluences.session === "ASIAN"
            ? "Lower volatility"
            : "Reduced liquidity";

    const tradeManagement: string[] = [];
    if (isLong) {
      tradeManagement.push(
        `Move SL to BE once price closes above ${signal.entry.toFixed(5)}`
      );
      tradeManagement.push("Trail SL under new bullish large range candles");
    } else {
      tradeManagement.push(
        `Move SL to BE once price closes below ${signal.entry.toFixed(5)}`
      );
      tradeManagement.push("Trail SL above new bearish large range candles");
    }

    let uiOrderType: string;
    let uiOrderDesc: string;

    if (signal.orderType === "market") {
      uiOrderType = isLong ? "MARKET_BUY" : "MARKET_SELL";
      uiOrderDesc = isLong
        ? "Market Buy — enter now"
        : "Market Sell — enter now";
    } else {
      uiOrderType = isLong ? "BUY_LIMIT" : "SELL_LIMIT";
      uiOrderDesc = isLong
        ? "Buy Limit — place pending below price"
        : "Sell Limit — place pending above price";
    }

    const direction = isLong ? "LONG" : "SHORT";
    const structureLine = overlays.structure.lastEvent
      ? `${overlays.structure.lastEvent.type} ${overlays.structure.lastEvent.direction}`
      : `structure ${overlays.structure.trend}`;
    const pdLine = overlays.premiumDiscount
      ? `${overlays.premiumDiscount.zone} (${(overlays.premiumDiscount.position * 100).toFixed(0)}% of range)`
      : "range unknown";

    const analysisText = `${signal.signalLabel} — ${pair} (${timeframe})

Zone: ${signal.zone.type.toUpperCase()} ${signal.zone.bottom.toFixed(5)} - ${signal.zone.top.toFixed(5)}
Entry: ${signal.entry.toFixed(5)}
Stop loss (2x ATR): ${signal.stopLoss.toFixed(5)}
TP1 (1.272 Fib): ${signal.takeProfit1.toFixed(5)}
TP2 (1.618 Fib): ${signal.takeProfit2.toFixed(5)}
TP3 (2.0 Fib): ${signal.takeProfit3.toFixed(5)}

Confidence: ${signal.confidence} (${signal.score}/100)
Risk: ${signal.riskPips} pips
R:R = 1:${signal.riskReward[0]} / 1:${signal.riskReward[1]} / 1:${signal.riskReward[2]}

SMC/ICT: ${smc.direction.toUpperCase()} bias, ${smc.score}/100 (${smc.confidence})
Structure: ${structureLine}
Premium/discount: ${pdLine}
Killzone: ${smc.killzone.name}`;

    const payload = {
      status: "signal",
      analysis: analysisText,
      smc,
      signal: {
        direction: signal.direction,
        orderType: uiOrderType,
        orderTypeDescription: uiOrderDesc,
        signalLabel: signal.signalLabel,

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
        dataSource: "dukascopy+yahoo-verified",
        status: "signal",

        zone: signal.zone,
        entrySignal: signal.entryCandle,
        confluences: signal.notes,
        candleCount: candles.length,
        confluenceBreakdown: signal.confluences,

        fibonacci,
        positionSizing,
        session: signal.confluences.session,
        sessionWeight,
        tradeManagement,
        priceVerification: signal.priceVerification,
      },
      direction,
    };

    // Best-effort event log — never blocks the response
    logAnalysisEvent({ session, pair, timeframe, direction, tier: userTier });

    return NextResponse.json(gateSignal(payload, userTier));
  } catch (error: any) {
    console.error("Analyze-chart error:", error);
    return NextResponse.json(
      { error: "Analysis failed", message: error?.message || String(error) },
      { status: 500 },
    );
  }
}