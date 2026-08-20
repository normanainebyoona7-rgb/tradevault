// src/app/api/admin/users/[id]/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import User from "@/lib/models/user";
import mongoose from "mongoose";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";

// PUT - Activate/Update user tier (admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { tier, status, durationDays } = body;

    await dbConnect();

    const updates: any = {};

    if (tier) {
      updates.tier = tier;
      const planNames: Record<string, string> = {
        free: "Free Trial",
        vip: "VIP Monthly",
        vvip: "VVIP Monthly",
      };
      updates.plan = planNames[tier] || "Free Trial";

      if (durationDays) {
        updates.planExpiry = new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000,
        );
      } else if (tier === "free") {
        updates.planExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      } else {
        updates.planExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      updates.tradesLimit = tier === "free" ? 50 : 999999;
    }

    if (status === "inactive") {
      updates.planExpiry = new Date(0); // Expired
    }

    const user = await User.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: updates },
      { new: true },
    ).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PUT user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

// DELETE - Remove user (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await dbConnect();

    await User.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
