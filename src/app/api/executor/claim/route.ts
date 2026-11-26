import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db/mongodb";
import { ADMIN_EMAIL } from "@/lib/admin";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionOrder, { IExecutionOrder } from "@/lib/models/execution-order";
import Signal from "@/lib/models/signal";
import { decryptSecret } from "@/lib/broker/crypto";
import {
  isExecutorAuthorized,
  isExecutorConfigured,
} from "@/lib/broker/executor-auth";

const NO_STORE = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

function orderPayload(order: IExecutionOrder, includeRequest = false) {
  return {
    executionId: String(order._id),
    claimToken: order.claimToken,
    signalId: String(order.signalId),
    pair: order.pair,
    direction: order.direction,
    orderType: order.orderType,
    entry: order.entry,
    stopLoss: order.stopLoss,
    takeProfit1: order.takeProfit1,
    takeProfit2: order.takeProfit2,
    takeProfit3: order.takeProfit3,
    expiresAt: order.expiresAt,
    mode: order.mode,
    configVersion: order.configVersion,
    status: order.status,
    request: includeRequest ? order.request : undefined,
    ticket: order.ticket,
    message: order.message,
  };
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
    const body = await request.json().catch(() => ({}));
    const executorId = String(body.executorId ?? "unknown").slice(0, 120);
    const leaseSeconds = Math.min(120, Math.max(30, Number(body.leaseSeconds) || 60));
    const limit = Math.min(5, Math.max(1, Number(body.limit) || 3));
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);

    await dbConnect();
    const conn = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL });
    if (!conn) {
      return NextResponse.json(
        { enabled: false, mode: "paper", reason: "No broker connection configured", orders: [], reconcile: [] },
        { headers: NO_STORE }
      );
    }
    if (!conn.enabled) {
      return NextResponse.json(
        { enabled: false, mode: conn.mode, reason: "Executor is disabled by the admin", orders: [], reconcile: [] },
        { headers: NO_STORE }
      );
    }
    if (conn.mode === "live" && !process.env.BROKER_ENCRYPTION_KEY) {
      return NextResponse.json(
        { enabled: false, mode: conn.mode, reason: "BROKER_ENCRYPTION_KEY is required for live trading", orders: [], reconcile: [] },
        { headers: NO_STORE }
      );
    }

    await BrokerConnection.updateOne(
      { _id: conn._id },
      { $set: { lastExecutorId: executorId, lastHeartbeatAt: now } }
    );

    await ExecutionOrder.updateMany(
      { status: "pending", expiresAt: { $lte: now } },
      { $set: { status: "cancelled", message: "Signal expired before execution" } }
    );
    await ExecutionOrder.updateMany(
      {
        status: "pending",
        connectionId: { $nin: [null, conn._id] },
      },
      { $set: { status: "cancelled", message: "Broker connection changed before execution" } }
    );
    await ExecutionOrder.updateMany(
      { status: "claimed", leaseExpiresAt: { $lt: now }, attempts: { $gte: 3 } },
      { $set: { status: "error", message: "Claim lease expired after maximum attempts" } }
    );

    const reconcileCandidates = await ExecutionOrder.find({
      status: { $in: ["submitting", "unknown"] },
      updatedAt: { $lt: new Date(now.getTime() - 5000) },
      $or: [
        { executorId },
        { leaseExpiresAt: { $lt: new Date(now.getTime() - 10000) } },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(10)
      .lean();

    const reconcile: ReturnType<typeof orderPayload>[] = [];
    for (const candidate of reconcileCandidates) {
      const claimToken = randomBytes(18).toString("hex");
      const updated = await ExecutionOrder.findOneAndUpdate(
        { _id: candidate._id, status: { $in: ["submitting", "unknown"] } },
        {
          $set: {
            claimToken,
            executorId,
            claimedAt: now,
            leaseExpiresAt,
          },
        },
        { new: true }
      );
      if (updated) reconcile.push(orderPayload(updated, true));
    }

    const candidates = await ExecutionOrder.find({
      status: { $in: ["pending", "claimed"] },
      expiresAt: { $gt: now },
      nextAttemptAt: { $lte: now },
      attempts: { $lt: 3 },
      $and: [
        {
          $or: [
            { status: "pending" },
            { status: "claimed", leaseExpiresAt: { $lt: now } },
          ],
        },
        {
          $or: [{ connectionId: null }, { connectionId: conn._id }],
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(limit * 3)
      .lean();

    const orders: ReturnType<typeof orderPayload>[] = [];
    for (const candidate of candidates) {
      if (orders.length >= limit) break;
      const signal: any = await Signal.findById(candidate.signalId)
        .select("isActive direction expiresAt")
        .lean();
      if (
        !signal ||
        !signal.isActive ||
        !["long", "short"].includes(String(signal.direction)) ||
        new Date(signal.expiresAt).getTime() <= now.getTime()
      ) {
        await ExecutionOrder.updateOne(
          { _id: candidate._id, status: candidate.status },
          { $set: { status: "cancelled", message: "Signal is inactive, invalid, or expired" } }
        );
        continue;
      }
      const claimToken = randomBytes(18).toString("hex");
      const filter: Record<string, unknown> = {
        _id: candidate._id,
        status: candidate.status,
        expiresAt: { $gt: now },
      };
      if (candidate.status === "claimed") filter.leaseExpiresAt = { $lt: now };
      const nextAttemptAt = new Date(
        now.getTime() + Math.min(60_000, (candidate.attempts + 1) * 10_000),
      );

      const claimed = await ExecutionOrder.findOneAndUpdate(
        filter,
        {
          $set: {
            status: "claimed",
            claimToken,
            executorId,
            claimedAt: now,
            leaseExpiresAt,
            mode: conn.mode,
            configVersion: conn.configVersion,
            connectionId: conn._id,
            message: "",
            nextAttemptAt,
          },
          $inc: { attempts: 1 },
        },
        { new: true }
      );
      if (claimed) orders.push(orderPayload(claimed));
    }

    let account = null;
    if (conn.mode === "live") {
      try {
        account = {
          login: conn.login,
          server: conn.server,
          password: decryptSecret(conn.passwordEnc),
        };
      } catch (error) {
        console.error("Executor credential decryption failed:", error);
        return NextResponse.json(
          { enabled: false, mode: conn.mode, reason: "Stored MT5 credentials could not be decrypted", orders: [], reconcile: [] },
          { status: 503, headers: NO_STORE }
        );
      }
    }

    return NextResponse.json(
      {
        enabled: true,
        mode: conn.mode,
        config: {
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
        },
        account,
        orders,
        reconcile,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("Executor claim error:", error);
    return NextResponse.json(
      { error: "Failed to claim execution orders" },
      { status: 500, headers: NO_STORE }
    );
  }
}
