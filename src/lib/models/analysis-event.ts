// src/lib/models/analysis-event.ts
import mongoose, { Schema, Document, models } from "mongoose";

export interface IAnalysisEvent extends Document {
  userEmail: string;
  userName: string;
  pair: string;
  timeframe: string;
  direction: string; // "long" | "short" | "neutral"
  tierAtTime: string;
  createdAt: Date;
}

const AnalysisEventSchema = new Schema<IAnalysisEvent>(
  {
    userEmail: { type: String, required: true, index: true },
    userName: { type: String, default: "" },
    pair: { type: String, required: true },
    timeframe: { type: String, default: "" },
    direction: { type: String, default: "neutral" },
    tierAtTime: { type: String, default: "free" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AnalysisEventSchema.index({ createdAt: -1 });

const AnalysisEvent =
  models.AnalysisEvent ||
  mongoose.model<IAnalysisEvent>("AnalysisEvent", AnalysisEventSchema);

export default AnalysisEvent;