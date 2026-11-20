import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionLog from "@/lib/models/execution-log";
import {
  isExecutorAuthorized,
  isExecutorConfigured,
} from "@/lib/broker/executor-auth";

const STATUSES = ["paper", "placed", "skipped", "error"];

export async function POST(request: Request) {
  if (!isExecutorConfigured()) {
    return NextResponse.json(
      { error: "EXECUTOR_SECRET is not configured on this server" },
      { status: 503 }
    );
  }
  if (!isExecutorAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await dbConnect();

    const conn = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });

    const update: Record<string, any> = { lastHeartbeatAt: new Date() };
    if (body.heartbeat) {
      update.lastError = String(body.error ?? "");
    } else if (body.error) {
      update.lastError = String(body.error);
    }
    if (conn) {
      await BrokerConnection.updateOne({ _id: conn._id }, { $set: update });
    }

    const executions = Array.isArray(body.executions)
      ? body.executions.slice(0, 50)
      : [];

    if (executions.length > 0 && conn) {
      const docs = executions
        .filter((e: any) => STATUSES.includes(e.status))
        .map((e: any) => ({
          connectionId: String(conn._id),
          signalId: String(e.signalId ?? ""),
          pair: String(e.pair ?? ""),
          direction: String(e.direction ?? ""),
          lots: Number(e.lots ?? 0),
          entry: Number(e.entry ?? 0),
          stopLoss: Number(e.stopLoss ?? 0),
          takeProfit: Number(e.takeProfit ?? 0),
          ticket:
            e.ticket !== null && e.ticket !== undefined && Number.isFinite(Number(e.ticket))
              ? Number(e.ticket)
              : null,
          status: e.status,
          mode: e.mode === "live" ? "live" : "paper",
          message: String(e.message ?? ""),
        }))
        .filter((e: any) => e.signalId && e.pair);
      if (docs.length > 0) await ExecutionLog.insertMany(docs);
    }

    return NextResponse.json({ ok: true, logged: executions.length });
  } catch (error) {
    console.error("POST executor report error:", error);
    return NextResponse.json(
      { error: "Failed to record execution report" },
      { status: 500 }
    );
  }
}
