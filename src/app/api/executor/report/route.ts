import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionLog from "@/lib/models/execution-log";
import ExecutionOrder, { ExecutionStatus } from "@/lib/models/execution-order";
import Signal from "@/lib/models/signal";
import {
  isExecutorAuthorized,
  isExecutorConfigured,
} from "@/lib/broker/executor-auth";

const NO_STORE = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

const FINAL_STATUSES = new Set<ExecutionStatus>([
  "submitted",
  "partial",
  "paper",
  "skipped",
  "error",
  "cancelled",
]);

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function logStatus(status: ExecutionStatus): "paper" | "placed" | "partial" | "skipped" | "error" | "unknown" {
  if (status === "submitted") return "placed";
  if (status === "cancelled") return "skipped";
  if (status === "paper" || status === "partial" || status === "skipped" || status === "error" || status === "unknown") {
    return status;
  }
  return "error";
}

async function writeExecutionLog(order: any, status: ExecutionStatus, body: any) {
  const mode = status === "paper" ? "paper" : order.mode;
  await ExecutionLog.findOneAndUpdate(
    { executionId: String(order._id) },
    {
      $set: {
        connectionId: String(order.connectionId ?? "deleted"),
        executorId: String(body.executorId ?? order.executorId ?? ""),
        signalId: String(order.signalId),
        pair: order.pair,
        direction: order.direction,
        orderType: order.orderType,
        lots: Math.max(0, Number(body.lots ?? order.lots ?? 0) || 0),
        entry: Number(body.entry ?? order.entry ?? 0) || 0,
        stopLoss: Number(body.stopLoss ?? order.stopLoss ?? 0) || 0,
        takeProfit: Number(body.takeProfit ?? order.takeProfit1 ?? 0) || 0,
        ticket: numberOrNull(body.ticket ?? order.ticket),
        dealTicket: numberOrNull(body.dealTicket ?? order.dealTicket),
        retcode: numberOrNull(body.retcode ?? order.retcode),
        status: logStatus(status),
        mode,
        message: String(body.message ?? order.message ?? "").slice(0, 1000),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );
  await Signal.updateOne(
    { _id: order.signalId },
    { $set: { executionStatus: status, executionOrderId: String(order._id) } }
  );
}

export async function POST(request: Request) {
  if (!isExecutorConfigured()) {
    return NextResponse.json(
      { error: "EXECUTOR_SECRET is not configured on this server" },
      { status: 503, headers: NO_STORE }
    );
  }
  if (!isExecutorAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
    }
    await dbConnect();

    const conn = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });
    if (conn) {
      const update: Record<string, unknown> = {
        lastHeartbeatAt: new Date(),
        lastExecutorId: String(body.executorId ?? conn.lastExecutorId ?? "").slice(0, 120),
      };
      if (body.heartbeat?.balance !== undefined) {
        const balance = Number(body.heartbeat.balance);
        if (Number.isFinite(balance)) update.lastBalance = balance;
      }
      if (body.heartbeat?.equity !== undefined) {
        const equity = Number(body.heartbeat.equity);
        if (Number.isFinite(equity)) update.lastEquity = equity;
      }
      if (body.error) update.lastError = String(body.error).slice(0, 1000);
      else if (body.heartbeat?.connected) update.lastError = "";
      await BrokerConnection.updateOne({ _id: conn._id }, { $set: update });
    }

    if (!body.executionId) {
      return NextResponse.json({ ok: true, accepted: true, logged: 0 }, { headers: NO_STORE });
    }

    const requested = body.status === "placed" ? "submitted" : String(body.status ?? "");
    if (!["submitting", "submitted", "partial", "unknown", "paper", "skipped", "error", "cancelled"].includes(requested)) {
      return NextResponse.json({ error: "Invalid execution status" }, { status: 400, headers: NO_STORE });
    }
    const status = requested as ExecutionStatus;
    const now = new Date();
    const order = await ExecutionOrder.findById(String(body.executionId));
    if (!order) {
      return NextResponse.json({ error: "Execution order not found" }, { status: 404, headers: NO_STORE });
    }
    const executorId = String(body.executorId ?? "");
    if (!executorId || !order.executorId || order.executorId !== executorId) {
      return NextResponse.json({ error: "Execution belongs to another executor" }, { status: 409, headers: NO_STORE });
    }
    if (!order.claimToken || order.claimToken !== String(body.claimToken ?? "")) {
      return NextResponse.json({ error: "Invalid or expired claim token" }, { status: 409, headers: NO_STORE });
    }
    if (status === "submitting" && (!order.leaseExpiresAt || order.leaseExpiresAt <= now)) {
      return NextResponse.json(
        { ok: true, accepted: false, status: order.status, error: "Claim lease expired before submission" },
        { status: 409, headers: NO_STORE }
      );
    }

    if (FINAL_STATUSES.has(order.status)) {
      if (order.status === status) {
        return NextResponse.json({ ok: true, accepted: true, status: order.status, logged: 0 }, { headers: NO_STORE });
      }
      return NextResponse.json(
        { ok: true, accepted: false, status: order.status, error: "Execution is already final" },
        { status: 409, headers: NO_STORE }
      );
    }

    if (status === "submitting") {
      if (order.status !== "claimed") {
        return NextResponse.json(
          { ok: true, accepted: false, status: order.status, error: "Execution is not in a claimable state" },
          { status: 409, headers: NO_STORE }
        );
      }
      const current = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });
      if (
        !current ||
        !current.enabled ||
        current.mode !== order.mode ||
        current.configVersion !== order.configVersion ||
        String(current._id) !== String(order.connectionId)
      ) {
        const reason = "Trade cancelled: executor disabled or risk settings changed";
        const cancelled = await ExecutionOrder.findOneAndUpdate(
          { _id: order._id, status: "claimed", claimToken: order.claimToken },
          { $set: { status: "cancelled", message: reason } },
          { new: true }
        );
        if (cancelled) await writeExecutionLog(cancelled, "cancelled", { message: reason });
        return NextResponse.json(
          { ok: true, accepted: false, status: "cancelled", error: reason },
          { headers: NO_STORE }
        );
      }

      let normalizedRequest: Record<string, unknown> | null = null;
      if (body.request && typeof body.request === "object" && !Array.isArray(body.request)) {
        try {
          normalizedRequest = JSON.stringify(body.request).length <= 10000 ? body.request : null;
        } catch {
          normalizedRequest = null;
        }
      }
      const updated = await ExecutionOrder.findOneAndUpdate(
        {
          _id: order._id,
          status: "claimed",
          claimToken: order.claimToken,
          executorId,
          leaseExpiresAt: { $gt: now },
        },
        {
          $set: {
            status: "submitting",
            lots: Math.max(0, Number(body.lots ?? 0) || 0),
            filledEntry: numberOrNull(body.entry),
            request: normalizedRequest,
            message: String(body.message ?? "Submitting order to MT5").slice(0, 1000),
          },
        },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json(
          { ok: true, accepted: false, status: "unknown", error: "Claim changed before submission" },
          { status: 409, headers: NO_STORE }
        );
      }
      return NextResponse.json({ ok: true, accepted: true, status: "submitting" }, { headers: NO_STORE });
    }

    const allowedCurrent: ExecutionStatus[] = ["claimed", "submitting", "unknown"];
    const updated = await ExecutionOrder.findOneAndUpdate(
      {
        _id: order._id,
        claimToken: order.claimToken,
        executorId,
        status: { $in: allowedCurrent },
      },
      {
        $set: {
          status,
          mode: status === "paper" ? "paper" : order.mode,
          lots: Math.max(0, Number(body.lots ?? order.lots ?? 0) || 0),
          ticket: numberOrNull(body.ticket) ?? order.ticket,
          dealTicket: numberOrNull(body.dealTicket) ?? order.dealTicket,
          retcode: numberOrNull(body.retcode) ?? order.retcode,
          filledEntry: numberOrNull(body.entry) ?? order.filledEntry,
          message: String(body.message ?? "").slice(0, 1000),
        },
      },
      { new: true }
    );

    if (!updated) {
      const latest = await ExecutionOrder.findById(order._id);
      if (latest?.status === status) {
        return NextResponse.json({ ok: true, accepted: true, status, logged: 0 }, { headers: NO_STORE });
      }
      return NextResponse.json(
        { ok: true, accepted: false, status: latest?.status ?? "unknown", error: "Execution state changed" },
        { status: 409, headers: NO_STORE }
      );
    }

    await writeExecutionLog(updated, status, body);
    return NextResponse.json({ ok: true, accepted: true, status, logged: 1 }, { headers: NO_STORE });
  } catch (error) {
    console.error("Executor report error:", error);
    return NextResponse.json(
      { error: "Failed to record execution report" },
      { status: 500, headers: NO_STORE }
    );
  }
}
