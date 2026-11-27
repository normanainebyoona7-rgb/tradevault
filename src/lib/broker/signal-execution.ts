import { ADMIN_EMAIL } from "@/lib/admin";
import { PAIRS } from "@/lib/pairs";
import BrokerConnection from "@/lib/models/broker-connection";
import ExecutionOrder, { IExecutionOrder } from "@/lib/models/execution-order";
import Signal, { ISignal } from "@/lib/models/signal";

export interface TradeLevelsInput {
  pair: unknown;
  direction: unknown;
  entry: unknown;
  stopLoss: unknown;
  takeProfit1: unknown;
  takeProfit2?: unknown;
  takeProfit3?: unknown;
  orderType?: unknown;
}

export interface ValidatedTradeLevels {
  pair: string;
  direction: "long" | "short";
  orderType: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
}

function optionalNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  return Number(value);
}

export function validateTradeLevels(input: TradeLevelsInput): ValidatedTradeLevels {
  const pair = String(input.pair ?? "").toUpperCase();
  const direction = String(input.direction ?? "").toLowerCase();
  const rawOrderType = String(input.orderType ?? "MARKET").toUpperCase();
  const entry = Number(input.entry);
  const stopLoss = Number(input.stopLoss);
  const takeProfit1 = Number(input.takeProfit1);
  const takeProfit2 = optionalNumber(input.takeProfit2);
  const takeProfit3 = optionalNumber(input.takeProfit3);

  let orderType = rawOrderType;
  if (orderType === "MARKET_BUY" || orderType === "MARKET_SELL") orderType = "MARKET";
  if (orderType === "LIMIT") orderType = direction === "long" ? "BUY_LIMIT" : "SELL_LIMIT";

  const errors: string[] = [];
  if (!PAIRS.includes(pair)) errors.push("pair not allowed");
  if (direction !== "long" && direction !== "short") errors.push("direction invalid");
  if (!["MARKET", "BUY_LIMIT", "SELL_LIMIT"].includes(orderType)) errors.push("orderType invalid");
  if (!Number.isFinite(entry) || entry <= 0) errors.push("entry invalid");
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) errors.push("stopLoss invalid");
  if (!Number.isFinite(takeProfit1) || takeProfit1 <= 0) errors.push("takeProfit1 required");
  if (!Number.isFinite(takeProfit2) || takeProfit2 < 0) errors.push("takeProfit2 invalid");
  if (!Number.isFinite(takeProfit3) || takeProfit3 < 0) errors.push("takeProfit3 invalid");
  if (orderType === "BUY_LIMIT" && direction !== "long") errors.push("buy limit requires long");
  if (orderType === "SELL_LIMIT" && direction !== "short") errors.push("sell limit requires short");

  if (errors.length === 0) {
    if (direction === "long") {
      if (stopLoss >= entry) errors.push("long stop loss must be below entry");
      if (takeProfit1 <= entry) errors.push("long TP1 must be above entry");
      if (takeProfit2 && takeProfit2 <= entry) errors.push("long TP2 must be above entry");
      if (takeProfit3 && takeProfit3 <= entry) errors.push("long TP3 must be above entry");
    } else {
      if (stopLoss <= entry) errors.push("short stop loss must be above entry");
      if (takeProfit1 >= entry) errors.push("short TP1 must be below entry");
      if (takeProfit2 && takeProfit2 >= entry) errors.push("short TP2 must be below entry");
      if (takeProfit3 && takeProfit3 >= entry) errors.push("short TP3 must be below entry");
    }
    if (takeProfit2 && (direction === "long" ? takeProfit2 <= takeProfit1 : takeProfit2 >= takeProfit1)) {
      errors.push("TP2 must be beyond TP1");
    }
    if (
      takeProfit3 &&
      (!takeProfit2 || (direction === "long" ? takeProfit3 <= takeProfit2 : takeProfit3 >= takeProfit2))
    ) {
      errors.push("TP3 must be beyond TP2");
    }
  }

  if (errors.length) throw new Error(errors.join(", "));

  return {
    pair,
    direction: direction as "long" | "short",
    orderType,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
  };
}

export async function enqueueSignalExecution(signal: ISignal): Promise<IExecutionOrder> {
  const levels = validateTradeLevels({
    pair: signal.pair,
    direction: signal.direction,
    orderType: signal.orderType,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit1: signal.takeProfit1,
    takeProfit2: signal.takeProfit2,
    takeProfit3: signal.takeProfit3,
  });
  const connection: any = await BrokerConnection.findOne({ ownerEmail: ADMIN_EMAIL }).select("_id").lean();
  const refreshed = await ExecutionOrder.updateOne(
    { signalId: signal._id, status: "pending" },
    {
      $set: {
        connectionId: connection?._id ?? null,
        pair: levels.pair,
        direction: levels.direction,
        orderType: levels.orderType,
        entry: levels.entry,
        stopLoss: levels.stopLoss,
        takeProfit1: levels.takeProfit1,
        takeProfit2: levels.takeProfit2,
        takeProfit3: levels.takeProfit3,
        expiresAt: signal.expiresAt,
        message: "",
        nextAttemptAt: new Date(),
      },
    }
  );
  if (refreshed.modifiedCount > 0) {
    await Signal.updateOne(
      { _id: signal._id },
      {
        $set: {
          pair: levels.pair,
          direction: levels.direction,
          orderType: levels.orderType,
          entry: String(levels.entry),
          stopLoss: String(levels.stopLoss),
          takeProfit1: String(levels.takeProfit1),
          takeProfit2: levels.takeProfit2 ? String(levels.takeProfit2) : "",
          takeProfit3: levels.takeProfit3 ? String(levels.takeProfit3) : "",
          expiresAt: signal.expiresAt,
        },
      }
    );
  }
  const order: any = await ExecutionOrder.findOneAndUpdate(
    { signalId: signal._id },
    {
      $setOnInsert: {
        signalId: signal._id,
        connectionId: connection?._id ?? null,
        pair: levels.pair,
        direction: levels.direction,
        orderType: levels.orderType,
        entry: levels.entry,
        stopLoss: levels.stopLoss,
        takeProfit1: levels.takeProfit1,
        takeProfit2: levels.takeProfit2,
        takeProfit3: levels.takeProfit3,
        expiresAt: signal.expiresAt,
        status: "pending",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Signal.updateOne(
    { _id: signal._id },
    { $set: { executionStatus: order.status, executionOrderId: String(order._id) } }
  );
  signal.executionStatus = order.status;
  signal.executionOrderId = String(order._id);
  return order;
}

export async function createExecutableSignal(input: {
  levels: TradeLevelsInput;
  dedupeKey?: string;
  isAutoGenerated?: boolean;
  source?: string;
  createdBy?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}): Promise<{ signal: ISignal; order: IExecutionOrder; duplicate: boolean }> {
  const levels = validateTradeLevels(input.levels);
  const dedupeKey = input.dedupeKey?.slice(0, 180);
  let signal = dedupeKey ? await Signal.findOne({ dedupeKey }) : null;
  let duplicate = !!signal;

  if (!signal) {
    try {
      signal = await Signal.create({
        pair: levels.pair,
        direction: levels.direction,
        orderType: levels.orderType,
        entry: String(levels.entry),
        stopLoss: String(levels.stopLoss),
        takeProfit1: String(levels.takeProfit1),
        takeProfit2: levels.takeProfit2 ? String(levels.takeProfit2) : "",
        takeProfit3: levels.takeProfit3 ? String(levels.takeProfit3) : "",
        isActive: true,
        isAutoGenerated: input.isAutoGenerated ?? true,
        source: input.source ?? "admin-manual",
        createdBy: input.createdBy ?? ADMIN_EMAIL,
        expiresAt: input.expiresAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000),
        dedupeKey,
        ...input.metadata,
      });
    } catch (error: any) {
      if (dedupeKey && error?.code === 11000) {
        signal = await Signal.findOne({ dedupeKey });
        duplicate = true;
      }
      if (!signal) throw error;
    }
  }

  const order = await enqueueSignalExecution(signal);
  return { signal, order, duplicate };
}
