// src/app/api/admin/broker/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { PAIRS } from "@/lib/pairs";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionOrder from "@/lib/models/execution-order";
import ExecutionLog from "@/lib/models/execution-log";
import Signal from "@/lib/models/signal";
import { encryptSecret } from "@/lib/broker/crypto";
import { isExecutorConfigured } from "@/lib/broker/executor-auth";
import { createExecutableSignal } from "@/lib/broker/signal-execution";
import { sendTelegramSignal } from "@/lib/telegram";

const NO_STORE = { "Cache-Control": "no-store" };

function isAdmin(session: any): boolean {
  const role = String(session?.role ?? session?.user?.role ?? "").toLowerCase();
  const email = String(session?.email ?? session?.user?.email ?? "");
  return ["admin", "owner", "superadmin"].includes(role) || isAdminEmail(email);
}

function publicConnection(conn: any) {
  if (!conn) return null;
  return {
    id: String(conn._id),
    login: conn.login,
    server: conn.server,
    hasPassword: !!conn.passwordEnc,
    mode: conn.mode,
    enabled: conn.enabled,
    riskPercent: conn.riskPercent,
    maxLot: conn.maxLot,
    maxDailyLossUsd: conn.maxDailyLossUsd,
    maxFloatingLossUsd: conn.maxFloatingLossUsd,
    maxOpenPositions: conn.maxOpenPositions,
    maxTradesPerDay: conn.maxTradesPerDay,
    maxSpreadPips: conn.maxSpreadPips,
    tpLevel: conn.tpLevel,
    symbolSuffix: conn.symbolSuffix,
    configVersion: conn.configVersion,
    lastExecutorId: conn.lastExecutorId,
    lastLiveEnabledAt: conn.lastLiveEnabledAt,
    lastLiveEnabledBy: conn.lastLiveEnabledBy,
    lastBalance: conn.lastBalance,
    lastEquity: conn.lastEquity,
    lastHeartbeatAt: conn.lastHeartbeatAt,
    lastError: conn.lastError,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

async function cancelUnsentOrders(connectionId: unknown, message: string) {
  const orders = await ExecutionOrder.find({
    connectionId,
    status: { $in: ["pending", "claimed"] },
  }).select("_id signalId").lean();
  if (!orders.length) return;
  await ExecutionOrder.updateMany(
    { _id: { $in: orders.map((order) => order._id) } },
    { $set: { status: "cancelled", message } }
  );
  await Signal.updateMany(
    { _id: { $in: orders.map((order) => order.signalId) } },
    { $set: { executionStatus: "cancelled" } }
  );
}

export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  await dbConnect();
  const conn = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL }).lean();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recent, pendingCount, attentionCount, paperTrades] = await Promise.all([
    ExecutionLog.find({ createdAt: { $gt: since } }).sort({ createdAt: -1 }).limit(25).lean(),
    ExecutionOrder.countDocuments({ status: { $in: ["pending", "claimed"] } }),
    ExecutionOrder.countDocuments({ status: { $in: ["submitting", "unknown"] } }),
    ExecutionLog.countDocuments({ mode: "paper", status: "paper" }),
  ]);

  return NextResponse.json(
    {
      executorConfigured: isExecutorConfigured(),
      encryptionConfigured: !!process.env.BROKER_ENCRYPTION_KEY,
      connection: publicConnection(conn),
      pendingCount,
      attentionCount,
      paperTrades,
      executions: recent.map((execution: any) => ({
        id: String(execution._id),
        executionId: execution.executionId,
        pair: execution.pair,
        direction: execution.direction,
        lots: execution.lots,
        entry: execution.entry,
        stopLoss: execution.stopLoss,
        takeProfit: execution.takeProfit,
        ticket: execution.ticket,
        status: execution.status,
        mode: execution.mode,
        message: execution.message,
        createdAt: execution.createdAt,
      })),
      allowedPairs: PAIRS,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  await dbConnect();
  const action = String(body.action ?? "connection").toLowerCase();

  if (action === "connection") {
    const existing = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });
    const update: Record<string, unknown> = {};
    const errors: string[] = [];

    const login = String(body.login ?? existing?.login ?? "").trim();
    const server = String(body.server ?? existing?.server ?? "").trim();
    const mode = body.mode === "live" || body.mode === "paper" ? body.mode : existing?.mode ?? "paper";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : existing?.enabled ?? false;
    if (!/^\d{4,20}$/.test(login)) errors.push("MT5 login must be numeric");
    if (!server || server.length > 100) errors.push("MT5 server is required");
    if (!existing?.passwordEnc && !body.password) errors.push("MT5 trading password is required");
    if (enabled && mode === "live" && body.confirmLive !== true) {
      errors.push("Confirm live trading explicitly before enabling real orders");
    }
    const armingLive = enabled && mode === "live" && (!existing?.enabled || existing.mode !== "live");
    if (armingLive) {
      const paperTrades = await ExecutionLog.countDocuments({ mode: "paper", status: "paper" });
      if (paperTrades < 1) errors.push("Complete at least one paper execution before arming live mode");
    }
    if (enabled && mode === "live" && !process.env.BROKER_ENCRYPTION_KEY) {
      errors.push("BROKER_ENCRYPTION_KEY must be configured before live trading");
    }
    if (enabled && mode === "live" && !isExecutorConfigured()) {
      errors.push("EXECUTOR_SECRET must be configured before live trading");
    }

    const numericFields: Array<[string, number, number, number]> = [
      ["riskPercent", 0.1, 10, existing?.riskPercent ?? 1],
      ["maxLot", 0.01, 50, existing?.maxLot ?? 0.1],
      ["maxDailyLossUsd", 0.01, 1000000, existing?.maxDailyLossUsd ?? 50],
      ["maxFloatingLossUsd", 0.01, 1000000, existing?.maxFloatingLossUsd ?? 100],
      ["maxOpenPositions", 1, 100, existing?.maxOpenPositions ?? 5],
      ["maxTradesPerDay", 1, 100, existing?.maxTradesPerDay ?? 10],
      ["maxSpreadPips", 0.1, 100, existing?.maxSpreadPips ?? 2],
    ];
    for (const [field, min, max, fallback] of numericFields) {
      const value = body[field] === undefined ? fallback : Number(body[field]);
      if (!Number.isFinite(value) || value < min || value > max) {
        errors.push(`${field} must be between ${min} and ${max}`);
      } else {
        update[field] = value;
      }
    }

    const tpLevel = Number(body.tpLevel ?? existing?.tpLevel ?? 1);
    if (![1, 2, 3].includes(tpLevel)) errors.push("tpLevel must be 1, 2, or 3");
    else update.tpLevel = tpLevel;

    const symbolSuffix = String(body.symbolSuffix ?? existing?.symbolSuffix ?? "").trim();
    if (!/^[A-Za-z0-9_.-]{0,20}$/.test(symbolSuffix)) errors.push("symbolSuffix contains invalid characters");
    else update.symbolSuffix = symbolSuffix;

    if (errors.length) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400, headers: NO_STORE });
    }

    update.login = login;
    update.server = server;
    update.mode = mode;
    update.enabled = enabled;
    update.configVersion = (existing?.configVersion ?? 0) + 1;
    if (body.password) update.passwordEnc = encryptSecret(String(body.password));
    if (enabled && mode === "live") {
      update.lastLiveEnabledAt = new Date();
      update.lastLiveEnabledBy = String(session.email ?? ADMIN_EMAIL);
    }

    const conn: any = await BrokerConnection.findOneAndUpdate(
      { ownerEmail: ADMIN_EMAIL },
      {
        $set: update,
        $setOnInsert: {
          ownerEmail: ADMIN_EMAIL,
          broker: "exness",
          platform: "mt5",
        },
      },
      { new: true, upsert: true }
    );

    if (!conn.enabled || (existing?.enabled && existing.mode !== conn.mode)) {
      await cancelUnsentOrders(conn._id, "Trading paused or mode changed before execution");
    }

    return NextResponse.json(
      { ok: true, connection: publicConnection(conn.toObject()) },
      { headers: NO_STORE }
    );
  }

  if (action === "signal") {
    try {
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 4 * 60 * 60 * 1000);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json({ error: "expiresAt must be a valid future date" }, { status: 400, headers: NO_STORE });
      }
      const { signal, duplicate } = await createExecutableSignal({
        levels: body,
        isAutoGenerated: true,
        source: "admin-manual",
        createdBy: String(session.email ?? ADMIN_EMAIL),
        expiresAt,
        metadata: {
          signalLabel: "ADMIN MANUAL",
          orderTypeDescription: "Admin manual trade",
          confidence: "ADMIN",
          notes: String(body.notes ?? "").slice(0, 500),
        },
      });

      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
        console.error("[AdminBroker] Telegram skipped — missing bot token or channel ID");
      } else {
        try {
          await sendTelegramSignal({
            pair: signal.pair,
            direction: signal.direction,
            signalLabel: "ADMIN MANUAL",
            orderType: signal.orderType || "MARKET",
            orderTypeDescription: "Admin manual trade",
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1,
            takeProfit2: "",
            takeProfit3: "",
            isAutoGenerated: true,
            zone: null,
            confidence: "ADMIN",
            score: 0,
            session: "",
          });
        } catch (telegramError) {
          console.error("Manual signal Telegram delivery failed:", telegramError);
        }
      }

      return NextResponse.json(
        { ok: true, signalId: String(signal._id), executionId: signal.executionOrderId, duplicate },
        { headers: NO_STORE }
      );
    } catch (error: any) {
      return NextResponse.json(
        { error: "Validation failed", message: String(error?.message ?? error).slice(0, 500) },
        { status: 400, headers: NO_STORE }
      );
    }
  }

  return NextResponse.json(
    { error: "Unknown action", valid: ["connection", "signal"] },
    { status: 400, headers: NO_STORE }
  );
}

export async function DELETE() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }
  await dbConnect();
  const conn: any = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL }).select("_id").lean();
  if (conn) await cancelUnsentOrders(conn._id, "Broker disconnected before execution");
  await BrokerConnection.deleteOne({ ownerEmail: ADMIN_EMAIL });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
