import mongoose, { Schema, Document, models } from "mongoose";

export interface IBrokerConnection extends Document {
  ownerEmail: string;
  broker: "exness";
  platform: "mt5";
  login: string;
  server: string;
  passwordEnc: string;
  mode: "paper" | "live";
  enabled: boolean;
  riskPercent: number;
  maxLot: number;
  maxDailyLossUsd: number;
  maxFloatingLossUsd: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  maxSpreadPips: number;
  tpLevel: number;
  symbolSuffix: string;
  configVersion: number;
  lastExecutorId: string;
  lastLiveEnabledAt: Date | null;
  lastLiveEnabledBy: string;
  lastBalance: number | null;
  lastEquity: number | null;
  lastHeartbeatAt: Date | null;
  lastError: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrokerConnectionSchema = new Schema<IBrokerConnection>(
  {
    ownerEmail: { type: String, required: true, unique: true, index: true },
    broker: { type: String, enum: ["exness"], default: "exness" },
    platform: { type: String, enum: ["mt5"], default: "mt5" },
    login: { type: String, required: true },
    server: { type: String, required: true },
    passwordEnc: { type: String, required: true },
    mode: { type: String, enum: ["paper", "live"], default: "paper" },
    enabled: { type: Boolean, default: false },
    riskPercent: { type: Number, default: 1, min: 0.1, max: 10 },
    maxLot: { type: Number, default: 0.1, min: 0.01, max: 50 },
    maxDailyLossUsd: { type: Number, default: 50, min: 0 },
    maxFloatingLossUsd: { type: Number, default: 100, min: 0 },
    maxOpenPositions: { type: Number, default: 5, min: 1, max: 100 },
    maxTradesPerDay: { type: Number, default: 10, min: 1, max: 100 },
    maxSpreadPips: { type: Number, default: 2, min: 0.1, max: 100 },
    tpLevel: { type: Number, enum: [1, 2, 3], default: 1 },
    symbolSuffix: { type: String, default: "" },
    configVersion: { type: Number, default: 1, min: 1 },
    lastExecutorId: { type: String, default: "" },
    lastLiveEnabledAt: { type: Date, default: null },
    lastLiveEnabledBy: { type: String, default: "" },
    lastBalance: { type: Number, default: null },
    lastEquity: { type: Number, default: null },
    lastHeartbeatAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

const BrokerConnection =
  models.BrokerConnection ||
  mongoose.model<IBrokerConnection>("BrokerConnection", BrokerConnectionSchema);

export default BrokerConnection;
