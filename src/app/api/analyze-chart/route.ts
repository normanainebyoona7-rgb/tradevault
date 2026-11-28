// src/app/api/analyze-chart/route.ts
// Analyzes a live chart with cross-source price verification, ATR-based SL,
// risk-multiple TPs, and an SMC / ICT / supply-demand breakdown.
// Orders emitted: BUY, SELL, BUY LIMIT, SELL LIMIT.
// Verified charts always stage an actionable setup; stale or unverified prices fail closed.
//
// Tier gating: free = TP1 only, vip = TP1+TP2, vvip = TP1..TP3 + descriptions.
// Admins (by email) bypass tier gating and always get vvip access.
// Enforcement happens server-side via gateSignal() — locked TPs never leave.
//
// Admin kill switch + ban: if Config.aiEnabled === false -> 423;
// if the user is banned -> 403. Neither changes AI logic.
// Activity logging: writes an AnalysisEvent doc (best-effort; never throws).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  TIMEFRAME_SECONDS,
  getCandlesWithSource,
  getClosedCandles,
} from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { buildSignal } from "@/lib/signal";
import { getVerifiedPrice } from "@/lib/analysis";
import { PAIRS, formatPrice } from "@/lib/pairs";
import {
  buildSMCSignal,
  type SMCCandle,
  type SMCSignal,
} from "@/lib/smc-analysis";
import { activeKillzone } from "@/lib/market-structure";
import type { Overlays } from "@/lib/overlays";
import { gateSignal, resolveTier, normalizeTier, isAdminEmail } from "@/lib/subscription";
import { dbConnect } from "@/lib/db/mongodb";
import { getGlobalConfig } from "@/lib/models/config";
import AnalysisEvent from "@/lib/models/analysis-event";
import User from "@/lib/models/user";
import { createExecutableSignal } from "@/lib/broker/signal-execution";
import { sendTelegramSignal } from "@/lib/telegram";

const TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1H", "4H", "1D"]);

function toSmcCandles(candles: ReturnType<typeof getClosedCandles>): SMCCandle[] {
  return candles.map((candle) => ({
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    is_green: candle.is_green,
  }));
}

function buildSmcPayload(
  pair: string,
  candles: SMCCandle[],
  overlays: Overlays,
  mtf5: SMCCandle[] | null = null,
  mtf15: SMCCandle[] | null = null
) {
  const smcSignal: SMCSignal | null =
    candles.length >= 50 ? buildSMCSignal(pair, candles, mtf5, mtf15) : null;

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
    volumeProfile: overlays.volumeProfile,
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
    let dbUser: any = null;
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

      dbUser = await User.findOne({
        email: String((session as any)?.email ?? "").toLowerCase(),
      })
        .select("banned bannedReason tier planExpiry")
        .lean();

      if (dbUser?.banned) {
        return NextResponse.json(
          {
            error: "Account banned",
            message:
              dbUser.bannedReason ||
              "Your account has been banned by the administrator.",
          },
          { status: 403 }
        );
      }
    } catch (e) {
      console.error("Analysis access check failed:", e);
      return NextResponse.json(
        {
          error: "Analysis unavailable",
          message: "Account access could not be verified. Please try again.",
        },
        { status: 503 }
      );
    }

    const planActive =
      !dbUser?.planExpiry || new Date(dbUser.planExpiry).getTime() > Date.now();
    const userTier = isAdminEmail((session as any)?.email)
      ? resolveTier(session)
      : planActive
        ? normalizeTier(dbUser?.tier)
        : "free";

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request", message: "Send a chart analysis request." },
        { status: 400 }
      );
    }

    const pair = String(body.pair || "EUR/USD");
    const timeframe = String(body.timeframe || "1H");
    if (!PAIRS.includes(pair) || !TIMEFRAMES.has(timeframe)) {
      return NextResponse.json(
        { error: "Unsupported market", message: "Choose a supported pair and timeframe." },
        { status: 400 }
      );
    }

    const primaryPromise = getCandlesWithSource(pair, timeframe, 340);
    const mtf5Promise =
      timeframe === "5m"
        ? primaryPromise
        : getCandlesWithSource(pair, "5m", 140);
    const mtf15Promise =
      timeframe === "15m"
        ? primaryPromise
        : getCandlesWithSource(pair, "15m", 140);

    const [dataset, mtf5Dataset, mtf15Dataset] = await Promise.all([
      primaryPromise,
      mtf5Promise,
      mtf15Promise,
    ]);
    const candles = getClosedCandles(dataset.candles, timeframe).slice(-300);
    const mtf5Candles = getClosedCandles(mtf5Dataset.candles, "5m").slice(-120);
    const mtf15Candles = getClosedCandles(mtf15Dataset.candles, "15m").slice(-120);

    if (candles.length < 50) {
      return NextResponse.json(
        {
          error: "Insufficient market data",
          message: `Not enough closed candles for ${pair} ${timeframe}.`,
        },
        { status: 409 }
      );
    }

    const latest = candles[candles.length - 1];
    const candleAgeMs =
      Date.now() - (latest.time + TIMEFRAME_SECONDS[timeframe]) * 1000;
    const staleAfterMs =
      timeframe === "1D"
        ? 3 * 86400_000
        : Math.max(TIMEFRAME_SECONDS[timeframe] * 3000, 15 * 60_000);
    if (candleAgeMs > staleAfterMs) {
      return NextResponse.json(
        {
          error: "Market data is stale",
          message: `The latest closed ${timeframe} candle is ${Math.round(candleAgeMs / 60000)} minutes old. Analysis is paused until fresh market data is available.`,
        },
        { status: 409 }
      );
    }

    const marketCandle = dataset.candles.at(-1);
    if (
      !marketCandle ||
      marketCandle.time < latest.time ||
      !Number.isFinite(marketCandle.close) ||
      marketCandle.close <= 0
    ) {
      return NextResponse.json(
        {
          error: "Live price unavailable",
          message: "The latest server candle does not contain a usable market price.",
        },
        { status: 409 }
      );
    }

    const marketPrice = marketCandle.close;
    const verified = await getVerifiedPrice(pair, {
      price: marketPrice,
      rawPrice: dataset.basisAdjustment?.rawPrice,
      source: dataset.source,
      timeframe,
      time: marketCandle.time,
    });
    if (!verified.ok) {
      return NextResponse.json(
        {
          error: "Price verification failed",
          message:
            verified.reason ||
            "Market prices could not be cross-validated. Analysis is paused until they agree.",
        },
        { status: 409 }
      );
    }
    const currentPrice =
      verified.comparisonSource !== "yahoo" && verified.comparisonPrice != null
        ? verified.comparisonPrice
        : marketPrice;
    const overlays = computeOverlays(pair, candles);
    const smc = buildSmcPayload(
      pair,
      toSmcCandles(candles),
      overlays,
      toSmcCandles(mtf5Candles),
      toSmcCandles(mtf15Candles)
    );
    const signal = buildSignal(
      pair,
      timeframe,
      candles,
      overlays,
      verified,
      { direction: smc.direction, score: smc.score },
      currentPrice
    );
    const structureLine = overlays.structure.lastEvent
      ? `${overlays.structure.lastEvent.type} ${overlays.structure.lastEvent.direction}`
      : `structure ${overlays.structure.trend}`;
    const pdLine = overlays.premiumDiscount
      ? `${overlays.premiumDiscount.zone} (${(overlays.premiumDiscount.position * 100).toFixed(0)}% of range)`
      : "range unknown";
    const priceCheck = verified.ok
      ? `Verified: ${verified.primarySource} vs ${verified.comparisonSource} (${verified.diffPct.toFixed(3)}% difference)`
      : verified.reason || "Price could not be cross-validated";
    const sourceLabel = dataset.basisAdjustment
      ? "server Yahoo futures candles basis-aligned to Swissquote spot + independent price verification"
      : `server ${dataset.source} candles`;
    const volumeLine = overlays.volumeProfile
      ? `Volume profile (${overlays.volumeProfile.source}): POC ${formatPrice(pair, overlays.volumeProfile.poc)} | VAH ${formatPrice(pair, overlays.volumeProfile.vah)} | VAL ${formatPrice(pair, overlays.volumeProfile.val)}`
      : "Volume profile: unavailable";

    if (signal.direction === "neutral") {
      return NextResponse.json(
        {
          error: "No tradeable setup",
          message:
            signal.notes.find((note) => !note.startsWith("Neutral")) ||
            "The chart does not contain enough market structure to stage a safe limit order.",
        },
        { status: 409 }
      );
    }

    const isLong = signal.direction === "long";
    const zoneHeight = Math.abs(signal.zone!.top - signal.zone!.bottom);
    const swingStart = isLong
      ? overlays.structure.lastSwingLow?.price ?? signal.zone!.bottom
      : overlays.structure.lastSwingHigh?.price ?? signal.zone!.top;
    const swingEnd = isLong
      ? overlays.structure.lastSwingHigh?.price ?? signal.zone!.top
      : overlays.structure.lastSwingLow?.price ?? signal.zone!.bottom;
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
      const breakEvenTrigger = signal.zone!.top + zoneHeight * 0.5;
      tradeManagement.push(
        `Move SL to break-even at ${formatPrice(pair, signal.entry)} after a closed candle above ${formatPrice(pair, breakEvenTrigger)}`
      );
      tradeManagement.push("Trail SL under new bullish large range candles");
    } else {
      const breakEvenTrigger = signal.zone!.bottom - zoneHeight * 0.5;
      tradeManagement.push(
        `Move SL to break-even at ${formatPrice(pair, signal.entry)} after a closed candle below ${formatPrice(pair, breakEvenTrigger)}`
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

    const analysisText = `${signal.signalLabel} — ${pair} (${timeframe})

Zone: ${signal.zone!.type.toUpperCase()} ${formatPrice(pair, signal.zone!.bottom)} - ${formatPrice(pair, signal.zone!.top)}
Zone source: ${signal.zone!.source}
Entry: ${formatPrice(pair, signal.entry)}
Stop loss (structure / ATR): ${formatPrice(pair, signal.stopLoss)}
TP1 (1.0R): ${formatPrice(pair, signal.takeProfit1)}
TP2 (1.5R): ${formatPrice(pair, signal.takeProfit2)}
TP3 (3.0R): ${formatPrice(pair, signal.takeProfit3)}

Confidence: ${signal.confidence} (${signal.score}/100)
Risk: ${signal.riskPips} pips
R:R = 1:${signal.riskReward[0]} / 1:${signal.riskReward[1]} / 1:${signal.riskReward[2]}

SMC/ICT: ${smc.direction.toUpperCase()} bias, ${smc.score}/100 (${smc.confidence})
Structure: ${structureLine}
Premium/discount: ${pdLine}
Killzone: ${smc.killzone.active ? smc.killzone.name : "No active killzone"}
${volumeLine}
Price check: ${priceCheck}`;

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
        setupId: signal.setupId,
        candleTime: latest.time,

        timeframe,
        dataSource: verified.ok
          ? `${sourceLabel} (verified)`
          : `${sourceLabel} (unverified)`,
        status: "signal",

        zone: signal.zone,
        entrySignal: signal.entryCandle,
        confluences: signal.notes,
        candleCount: candles.length,
        confluenceBreakdown: signal.confluences,
        volumeProfile: signal.volumeProfile,

        fibonacci,
        positionSizing: {
          lots: null,
          note: "Lot size is calculated from the connected broker account and configured risk at execution.",
        },
        session: signal.confluences.session,
        sessionWeight,
        tradeManagement,
        priceVerification: signal.priceVerification,
      },
      direction,
    };

    await logAnalysisEvent({ session, pair, timeframe, direction, tier: userTier });

    let executionId: string | undefined;
    let executionStatus: string | undefined;
    let duplicate = false;
    if (body.autoExecute === true && isAdminEmail((session as any)?.email)) {
      try {
        const dedupeKey = signal.setupId.slice(0, 180);
        const expiresAt = new Date(
          Date.now() + (signal.orderType === "market" ? 5 : 30) * 60 * 1000
        );
        const queued = await createExecutableSignal({
          levels: {
            pair,
            direction: signal.direction,
            orderType: uiOrderType,
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1,
            takeProfit2: signal.takeProfit2,
            takeProfit3: signal.takeProfit3,
          },
          dedupeKey,
          isAutoGenerated: true,
          source: "ai-analyze",
          createdBy: String((session as any)?.email ?? "admin"),
          expiresAt,
          metadata: {
            orderTypeDescription: uiOrderDesc,
            signalLabel: signal.signalLabel,
            zone: signal.zone,
            confidence: signal.confidence,
            score: signal.score,
            session: signal.confluences.session,
            timeframe,
            notes: `AI ${timeframe} analysis; ${priceCheck}`,
          },
        });
        executionId = String(queued.order._id);
        executionStatus = queued.order.status;
        duplicate = queued.duplicate;

        if (!duplicate && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
          try {
            await sendTelegramSignal({
              pair,
              direction: signal.direction,
              signalLabel: signal.signalLabel,
              orderType: uiOrderType,
              orderTypeDescription: uiOrderDesc,
              entry: String(signal.entry),
              stopLoss: String(signal.stopLoss),
              takeProfit1: String(signal.takeProfit1),
              takeProfit2: "",
              takeProfit3: "",
              isAutoGenerated: true,
              zone: signal.zone,
              confidence: signal.confidence,
              score: signal.score,
              session: signal.confluences.session,
            });
          } catch (telegramError) {
            console.error("AI signal Telegram delivery failed:", telegramError);
          }
        }
      } catch (queueError) {
        console.error("AI execution enqueue failed:", queueError);
        return NextResponse.json(
          {
            error: "Execution queue unavailable",
            message: "Analysis completed, but the trade was not queued. No order was sent.",
            analysis: payload,
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({
      ...gateSignal(payload, userTier),
      executionId,
      executionStatus,
      executionQueued: executionStatus != null && ["pending", "claimed", "submitting"].includes(executionStatus),
      autoExecuted: !!executionId,
      duplicate,
    });
  } catch (error: any) {
    console.error("Analyze-chart error:", error);
    return NextResponse.json(
      {
        error: "Analysis failed",
        message: "The analysis service could not complete this request. Please try again.",
      },
      { status: 500 },
    );
  }
}