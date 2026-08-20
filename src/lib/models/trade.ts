// src/lib/models/trade.ts

import mongoose, { Schema, Document, models } from "mongoose";

export interface ITrade extends Document {
  userId: string;
  tradeNumber: number;
  pair: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  exitPrice: number | null;
  exitDate: Date | null;
  riskAmount: number;
  rewardAmount: number;
  pnl: number | null;
  rMultiple: number | null;
  status: "win" | "loss" | "breakeven" | "open";
  session: string;
  strategy: string;
  tags: string[];
  notes: string;
  mistakes: string[];
  screenshots: Array<{ url: string; label: string }>;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    userId: { type: String, required: true, index: true },
    tradeNumber: { type: Number, required: true },
    pair: { type: String, required: true },
    direction: { type: String, enum: ["long", "short"], required: true },
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number },
    positionSize: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    exitDate: { type: Date, default: null },
    riskAmount: { type: Number, default: 0 },
    rewardAmount: { type: Number, default: 0 },
    pnl: { type: Number, default: null },
    rMultiple: { type: Number, default: null },
    status: {
      type: String,
      enum: ["win", "loss", "breakeven", "open"],
      default: "open",
    },
    session: { type: String, default: "london" },
    strategy: { type: String, default: "" },
    tags: { type: [String], default: [] },
    notes: { type: String, default: "" },
    mistakes: { type: [String], default: [] },
    screenshots: { type: [{ url: String, label: String }], default: [] },
    entryDate: { type: Date, required: true },
  },
  { timestamps: true },
);

const Trade = models.Trade || mongoose.model<ITrade>("Trade", TradeSchema);

export default Trade;
