// src/lib/models/config.ts
import mongoose, { Schema, Document, models } from "mongoose";

export interface IConfig extends Document {
  key: string; // always "global"
  aiEnabled: boolean;
  aiDisabledMessage: string;
  updatedBy: string;
  updatedAt: Date;
}

const ConfigSchema = new Schema<IConfig>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    aiEnabled: { type: Boolean, default: true },
    aiDisabledMessage: {
      type: String,
      default: "AI analysis is temporarily disabled by the administrator.",
    },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

const Config = models.Config || mongoose.model<IConfig>("Config", ConfigSchema);

export default Config;

export async function getGlobalConfig() {
  let cfg = await Config.findOne({ key: "global" });
  if (!cfg) {
    cfg = await Config.create({ key: "global", aiEnabled: true });
  }
  return cfg;
}