// src/app/api/analyze-chart/route.ts
// Analyzes a live chart with cross-source price verification, ATR-based SL,
// risk-multiple TPs, and an SMC / ICT / supply-demand breakdown.
// Orders emitted: BUY, SELL, BUY LIMIT, SELL LIMIT — NO NEUTRAL orders.
//
// NEUTRAL: when buildSignal returns direction "neutral", we return status
// "neutral" with no save and no Telegram — callers must treat it as "no trade".
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
import { getCandles, type Candle } from "@/lib/data/candles";
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

function parseChartCandles(value: unknown): Candle[] | null {
  if (!Array.isArray(value) || value.length < 50 || value.length > 400) {
    return null;
  }

  const candles: Candle[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { time, open, high, low, close, volume } = item as Record<string, unknown>;
    if (![time, open, high, low, close].every(Number.isFinite)) return null;
    if (Number(open) <= 0 || Number(close) <= 0 || Number(low) <= 0) return null;
    if (Number(high) < Math.max(Number(open), Number(close))) return null;
    if (Number(low) > Math.min(Number(open), Number(close))) return null;
    candles.push({
      time: Number(time),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number.isFinite(volume) ? Number(volume) : 0,
      is_green: Number(close) >= Number(open),
    });
  }

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].time <= candles[i - 1].time) return null;
  }
  return candles;
}

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

    const candles =
      parseChartCandles(body.candles) ??
      (await getCandles(pair, timeframe, 300));

    if (candles.length === 0) {
      return NextResponse.json(
        {
          error: "No market data",
          message: `Could not fetch candles for ${pair} ${timeframe}.`,
        },
        { status: 400 }
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
    const structureLine = overlays.structure.lastEvent
      ? `${overlays.structure.lastEvent.type} ${overlays.structure.lastEvent.direction}`
      : `structure ${overlays.structure.trend}`;
    const pdLine = overlays.premiumDiscount
      ? `${overlays.premiumDiscount.zone} (${(overlays.premiumDiscount.position * 100).toFixed(0)}% of range)`
      : "range unknown";
    const priceCheck = verified.ok
      ? `Verified across sources (${verified.diffPct.toFixed(3)}% difference)`
      : verified.reason || "Price could not be cross-validated";

    // ---- NEUTRAL: no valid trade ----
    if (signal.direction === "neutral") {
      await logAnalysisEvent({
        session,
        pair,
        timeframe,
        direction: "neutral",
        tier: userTier,
      });

      const analysisText = `NEUTRAL — ${pair} (${timeframe})

Decision: No trade
${signal.notes.map((note) => `• ${note}`).join("\n")}

Current price: ${formatPrice(pair, currentPrice)}
SMC/ICT bias: ${smc.direction.toUpperCase()} · ${smc.score}/100 (${smc.confidence})
Structure: ${structureLine}
Premium/discount: ${pdLine}
Killzone: ${smc.killzone.active ? smc.killzone.name : "No active killzone"}
Price check: ${priceCheck}`;

      return NextResponse.json(
        gateSignal(
          {
            status: "neutral",
            message:
              signal.notes
                .find((note) => note.startsWith("Neutral"))
                ?.replace(/^Neutral\s*[—-]\s*/i, "") ||
              "No valid trade setup right now.",
            analysis: analysisText,
            smc,
            signal: {
              direction: "neutral",
              signalLabel: "NEUTRAL",
              confidence: "NEUTRAL",
              confidenceScore: 0,
              notes: signal.notes,
              zone: signal.zone,
              entryCandle: signal.entryCandle,
              currentPrice,
              entryPrice: null,
              stopLossPrice: null,
              takeProfit1Price: null,
              takeProfit2Price: null,
              takeProfit3Price: null,
              riskPips: 0,
              timeframe,
              candleCount: candles.length,
              confluenceBreakdown: signal.confluences,
              priceVerification: signal.priceVerification,
              dataSource: verified.ok
                ? "cross-source verified"
                : "live chart data (unverified)",
            },
            direction: "NEUTRAL",
          },
          userTier
        )
      );
    }

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

    const analysisText = `${signal.signalLabel} — ${pair} (${timeframe})

Zone: ${signal.zone!.type.toUpperCase()} ${formatPrice(pair, signal.zone!.bottom)} - ${formatPrice(pair, signal.zone!.top)}
Entry: ${formatPrice(pair, signal.entry)}
Stop loss (2x ATR): ${formatPrice(pair, signal.stopLoss)}
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

        timeframe,
        dataSource: verified.ok
          ? "live candles + independent price verification"
          : "live candles (unverified)",
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

    await logAnalysisEvent({ session, pair, timeframe, direction, tier: userTier });

    let executionId: string | undefined;
    let duplicate = false;
    if (body.autoExecute === true && isAdminEmail((session as any)?.email)) {
      try {
        const lastCandleTime = candles[candles.length - 1].time;
        const dedupeKey = [
          "ai",
          pair,
          timeframe,
          lastCandleTime,
          signal.direction,
          signal.entry,
          signal.stopLoss,
          signal.takeProfit1,
        ].join(":");
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
      autoExecuted: !!executionId,
      duplicate,
    });
  } catch (error: any) {
    console.error("Analyze-chart error:", error);
    return NextResponse.json(
      { error: "Analysis failed", message: error?.message || String(error) },
      { status: 500 },
    );
  }
}