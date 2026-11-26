import mongoose, { Schema, Document, models } from "mongoose";

export type ExecutionStatus =
  | "pending"
  | "claimed"
  | "submitting"
  | "submitted"
  | "partial"
  | "unknown"
  | "paper"
  | "skipped"
  | "error"
  | "cancelled";

export interface IExecutionOrder extends Document {
  signalId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId | null;
  pair: string;
  direction: "long" | "short";
  orderType: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  expiresAt: Date;
  status: ExecutionStatus;
  mode: "paper" | "live";
  configVersion: number;
  executorId: string;
  claimToken: string;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  attempts: number;
  nextAttemptAt: Date;
  lots: number;
  ticket: number | null;
  dealTicket: number | null;
  retcode: number | null;
  filledEntry: number | null;
  message: string;
  request: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExecutionOrderSchema = new Schema<IExecutionOrder>(
  {
    signalId: { type: Schema.Types.ObjectId, ref: "Signal", required: true, unique: true },
    connectionId: { type: Schema.Types.ObjectId, ref: "BrokerConnection", default: null, index: true },
    pair: { type: String, required: true },
    direction: { type: String, enum: ["long", "short"], required: true },
    orderType: { type: String, required: true },
    entry: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    takeProfit1: { type: Number, default: 0 },
    takeProfit2: { type: Number, default: 0 },
    takeProfit3: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "claimed",
        "submitting",
        "submitted",
        "partial",
        "unknown",
        "paper",
        "skipped",
        "error",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    mode: { type: String, enum: ["paper", "live"], default: "paper" },
    configVersion: { type: Number, default: 0 },
    executorId: { type: String, default: "" },
    claimToken: { type: String, default: "" },
    claimedAt: { type: Date, default: null },
    leaseExpiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lots: { type: Number, default: 0 },
    ticket: { type: Number, default: null },
    dealTicket: { type: Number, default: null },
    retcode: { type: Number, default: null },
    filledEntry: { type: Number, default: null },
    message: { type: String, default: "" },
    request: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

ExecutionOrderSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
ExecutionOrderSchema.index({ status: 1, executorId: 1, updatedAt: 1 });

const ExecutionOrder =
  models.ExecutionOrder ||
  mongoose.model<IExecutionOrder>("ExecutionOrder", ExecutionOrderSchema);

export default ExecutionOrder;
