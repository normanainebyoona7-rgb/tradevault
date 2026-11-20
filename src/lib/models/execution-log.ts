import mongoose, { Schema, Document, models } from "mongoose";

export interface IExecutionLog extends Document {
  connectionId: string;
  signalId: string;
  pair: string;
  direction: string;
  lots: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  ticket: number | null;
  status: "paper" | "placed" | "skipped" | "error";
  mode: "paper" | "live";
  message: string;
  createdAt: Date;
}

const ExecutionLogSchema = new Schema<IExecutionLog>(
  {
    connectionId: { type: String, required: true, index: true },
    signalId: { type: String, required: true, index: true },
    pair: { type: String, required: true },
    direction: { type: String, default: "" },
    lots: { type: Number, default: 0 },
    entry: { type: Number, default: 0 },
    stopLoss: { type: Number, default: 0 },
    takeProfit: { type: Number, default: 0 },
    ticket: { type: Number, default: null },
    status: {
      type: String,
      enum: ["paper", "placed", "skipped", "error"],
      required: true,
    },
    mode: { type: String, enum: ["paper", "live"], required: true },
    message: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ExecutionLog =
  models.ExecutionLog ||
  mongoose.model<IExecutionLog>("ExecutionLog", ExecutionLogSchema);

export default ExecutionLog;
