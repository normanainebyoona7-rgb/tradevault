// src/app/api/trades/route.ts
// Handles: GET (list all trades for user), POST (create new trade)

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

    const trades = await Trade.find({ userId })
      .sort({ entryDate: -1 })
      .lean();

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("GET trades error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await dbConnect();
    const userId = new mongoose.Types.ObjectId(session.id);

    const trade = await Trade.create({ ...body, userId });

    return NextResponse.json({ trade }, { status: 201 });
  } catch (error) {
    console.error("POST trade error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}