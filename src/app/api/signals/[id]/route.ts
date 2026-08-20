// src/app/api/signals/[id]/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import Signal from "@/lib/models/signal";
import mongoose from "mongoose";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.email !== "normanainebyoona7@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    await Signal.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    return NextResponse.json({ message: "Signal deleted" });
  } catch (error) {
    console.error("DELETE signal error:", error);
    return NextResponse.json(
      { error: "Failed to delete signal" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.email !== "normanainebyoona7@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    const signal = await Signal.findById(new mongoose.Types.ObjectId(id));
    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    signal.isActive = !signal.isActive;
    await signal.save();

    return NextResponse.json({ signal });
  } catch (error) {
    console.error("PUT signal error:", error);
    return NextResponse.json(
      { error: "Failed to update signal" },
      { status: 500 },
    );
  }
}
