// src/app/api/analytics/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import mongoose from "mongoose";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(session.id);

    const trades = await Trade.find({ userId }).sort({ entryDate: -1 }).lean();

    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.status === "win").length;
    const losses = trades.filter((t) => t.status === "loss").length;
    const breakeven = trades.filter((t) => t.status === "breakeven").length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return NextResponse.json({
      totalTrades,
      wins,
      losses,
      breakeven,
      winRate,
      totalPnl,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
