// src/app/api/admin/broker/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import BrokerConnection from "@/lib/models/broker-connection";
import Signal from "@/lib/models/signal";
import ExecutionLog from "@/lib/models/execution-log";
import { isExecutorConfigured } from "@/lib/broker/executor-auth";
import { sendTelegramSignal } from "@/lib/telegram";

const NO_STORE = { "Cache-Control": "no-store" };

const ALLOWED_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD",
];

function isAdmin(session: any): boolean {
  const role = String(session?.role ?? session?.user?.role ?? "").toLowerCase();
  const email = String(session?.email ?? session?.user?.email ?? "").toLowerCase();
  const adminEmail = String(ADMIN_EMAIL ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "superadmin") return true;
  if (adminEmail && email === adminEmail) return true;
  return false;
}

/* ---------------- GET ---------------- */
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const conn: any = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL }).lean();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await ExecutionLog.find({ createdAt: { $gt: since } })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  return NextResponse.json(
    {
      executorConfigured: isExecutorConfigured(),
      connection: conn ? { ...conn, hasPassword: !!conn.passwordEnc } : null,
      executions: recent.map((e: any) => ({
        id: String(e._id),
        pair: e.pair,
        direction: e.direction,
        lots: e.lots,
        status: e.status,
        mode: e.mode,
        message: e.message,
        createdAt: e.createdAt,
      })),
      allowedPairs: ALLOWED_PAIRS,
    },
    { headers: NO_STORE }
  );
}

/* ---------------- POST ---------------- */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await dbConnect();

  const action = String(body.action ?? "").toLowerCase();

  // --- Save/update connection ---
  if (!action || action === "connection") {
    const update: Record<string, any> = {};

    if (body.login != null) update.login = String(body.login);
    if (body.server != null) update.server = String(body.server);
    if (body.mode === "paper" || body.mode === "live") update.mode = body.mode;
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    if (body.symbolSuffix != null) update.symbolSuffix = String(body.symbolSuffix);
    if (body.riskPercent != null) {
      const v = Number(body.riskPercent);
      if (Number.isFinite(v) && v > 0 && v <= 10) update.riskPercent = v;
    }
    if (body.maxLot != null) {
      const v = Number(body.maxLot);
      if (Number.isFinite(v) && v > 0 && v <= 50) update.maxLot = v;
    }
    if (body.maxDailyLossUsd != null) {
      const v = Number(body.maxDailyLossUsd);
      if (Number.isFinite(v) && v >= 0) update.maxDailyLossUsd = v;
    }
    if (body.tpLevel != null) {
      const v = Number(body.tpLevel);
      if ([1, 2, 3].includes(v)) update.tpLevel = v;
    }
    if (body.password) {
      const { encryptSecret } = await import("@/lib/broker/crypto");
      update.passwordEnc = encryptSecret(String(body.password));
    }

    const conn: any = await BrokerConnection.findOneAndUpdate(
      { ownerEmail: ADMIN_EMAIL },
      { $set: update, $setOnInsert: { ownerEmail: ADMIN_EMAIL } },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json(
      { ok: true, connection: conn ? { ...conn, hasPassword: !!conn.passwordEnc } : null },
      { headers: NO_STORE }
    );
  }

  // --- Create manual signal (+ post to Telegram, TP1 only) ---
  if (action === "signal") {
    const pair = String(body.pair ?? "").toUpperCase();
    const direction = String(body.direction ?? "").toLowerCase();
    const orderType = String(body.orderType ?? "MARKET").toUpperCase();
    const entry = Number(body.entry);
    const stopLoss = Number(body.stopLoss);
    const tp1 = Number(body.takeProfit1);
    const tp2 = body.takeProfit2 ? Number(body.takeProfit2) : NaN;
    const tp3 = body.takeProfit3 ? Number(body.takeProfit3) : NaN;

    const errors: string[] = [];
    if (!ALLOWED_PAIRS.includes(pair)) errors.push("pair not allowed");
    if (!["long", "short"].includes(direction)) errors.push("direction invalid");
    if (!["MARKET", "BUY_LIMIT", "SELL_LIMIT", "LIMIT"].includes(orderType))
      errors.push("orderType invalid");
    if (!Number.isFinite(entry) || entry <= 0) errors.push("entry invalid");
    if (!Number.isFinite(stopLoss) || stopLoss <= 0) errors.push("stopLoss invalid");
    if (!Number.isFinite(tp1) || tp1 <= 0) errors.push("takeProfit1 required");
    if (errors.length) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    const normalizedOrderType =
      orderType === "LIMIT"
        ? direction === "long"
          ? "BUY_LIMIT"
          : "SELL_LIMIT"
        : orderType;

    const doc = await Signal.create({
      pair,
      direction,
      orderType: normalizedOrderType,
      entry: String(entry),
      stopLoss: String(stopLoss),
      takeProfit1: String(tp1),
      takeProfit2: Number.isFinite(tp2) ? String(tp2) : "",
      takeProfit3: Number.isFinite(tp3) ? String(tp3) : "",
      isActive: true,
      isAutoGenerated: true,
      signalLabel: "ADMIN MANUAL",
      source: "admin-manual",
      createdBy: String((session as any)?.email ?? "admin"),
      notes: String(body.notes ?? "").slice(0, 500),
    });

    // ---- Telegram: ALWAYS TP1-only, even though admin stored TP2/TP3 ----
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL_ID) {
      console.error(
        "[AdminBroker] Telegram skipped — missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID in environment"
      );
    } else {
      await sendTelegramSignal({
        pair,
        direction,
        signalLabel: "ADMIN MANUAL",
        orderType: normalizedOrderType,
        orderTypeDescription: "Admin manual trade",
        entry: String(entry),
        stopLoss: String(stopLoss),
        takeProfit1: String(tp1),
        // Deliberately empty — channel stays TP1-only.
        takeProfit2: "",
        takeProfit3: "",
        isAutoGenerated: true,
        zone: null,
        confidence: "ADMIN",
        score: 0,
        session: "",
      });
    }

    return NextResponse.json(
      { ok: true, signalId: String(doc._id) },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { error: "Unknown action", valid: ["connection", "signal"] },
    { status: 400 }
  );
}

/* ---------------- DELETE ---------------- */
export async function DELETE() {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  await BrokerConnection.deleteOne({ ownerEmail: ADMIN_EMAIL });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}