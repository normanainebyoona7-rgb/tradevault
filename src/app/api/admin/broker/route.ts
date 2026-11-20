import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { isAdminEmail, ADMIN_EMAIL } from "@/lib/admin";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionLog from "@/lib/models/execution-log";
import { encryptSecret } from "@/lib/broker/crypto";
import { isExecutorConfigured } from "@/lib/broker/executor-auth";

function sanitize(conn: any) {
  return {
    broker: conn.broker,
    platform: conn.platform,
    login: conn.login,
    server: conn.server,
    mode: conn.mode,
    enabled: conn.enabled,
    riskPercent: conn.riskPercent,
    maxLot: conn.maxLot,
    maxDailyLossUsd: conn.maxDailyLossUsd,
    tpLevel: conn.tpLevel,
    symbolSuffix: conn.symbolSuffix,
    hasPassword: !!conn.passwordEnc,
    lastHeartbeatAt: conn.lastHeartbeatAt,
    lastError: conn.lastError,
    updatedAt: conn.updatedAt,
  };
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !isAdminEmail(session.email)) return unauthorized();

    await dbConnect();
    const conn = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });
    const executions = await ExecutionLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      connection: conn ? sanitize(conn) : null,
      executions: executions.map((e: any) => ({
        id: String(e._id),
        pair: e.pair,
        direction: e.direction,
        lots: e.lots,
        status: e.status,
        mode: e.mode,
        ticket: e.ticket,
        message: e.message,
        createdAt: e.createdAt,
      })),
      executorConfigured: isExecutorConfigured(),
      encryptionConfigured: !!(
        process.env.BROKER_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
      ),
    });
  } catch (error) {
    console.error("GET broker error:", error);
    return NextResponse.json(
      { error: "Failed to load broker connection" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !isAdminEmail(session.email)) return unauthorized();

    const body = await request.json();
    const login = String(body.login ?? "").trim();
    const server = String(body.server ?? "").trim();
    const password = String(body.password ?? "");
    const mode = body.mode === "live" ? "live" : "paper";
    const enabled = !!body.enabled;
    const riskPercent = Number(body.riskPercent ?? 1);
    const maxLot = Number(body.maxLot ?? 0.1);
    const maxDailyLossUsd = Number(body.maxDailyLossUsd ?? 50);
    const tpLevel = [1, 2, 3].includes(Number(body.tpLevel))
      ? Number(body.tpLevel)
      : 1;
    const symbolSuffix = String(body.symbolSuffix ?? "").trim();

    if (!login || !server) {
      return NextResponse.json(
        { error: "MT5 login and server are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 10) {
      return NextResponse.json(
        { error: "Risk percent must be between 0.1 and 10" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(maxLot) || maxLot <= 0 || maxLot > 50) {
      return NextResponse.json(
        { error: "Max lot must be between 0.01 and 50" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(maxDailyLossUsd) || maxDailyLossUsd < 0) {
      return NextResponse.json(
        { error: "Max daily loss must be zero or positive" },
        { status: 400 }
      );
    }

    await dbConnect();
    const existing = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });

    if (!existing && !password) {
      return NextResponse.json(
        { error: "MT5 password is required for a new connection" },
        { status: 400 }
      );
    }

    let passwordEnc = existing?.passwordEnc;
    if (password) passwordEnc = encryptSecret(password);

    const update = {
      ownerEmail: ADMIN_EMAIL,
      broker: "exness" as const,
      platform: "mt5" as const,
      login,
      server,
      passwordEnc: passwordEnc as string,
      mode: mode as "paper" | "live",
      enabled,
      riskPercent,
      maxLot,
      maxDailyLossUsd,
      tpLevel,
      symbolSuffix,
    };

    const conn = await BrokerConnection.findOneAndUpdate(
      { ownerEmail: ADMIN_EMAIL },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true, connection: sanitize(conn) });
  } catch (error) {
    console.error("POST broker error:", error);
    return NextResponse.json(
      { error: "Failed to save broker connection" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || !isAdminEmail(session.email)) return unauthorized();

    await dbConnect();
    await BrokerConnection.findOneAndDelete({ ownerEmail: ADMIN_EMAIL });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE broker error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect broker" },
      { status: 500 }
    );
  }
}
