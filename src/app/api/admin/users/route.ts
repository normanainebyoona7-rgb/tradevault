// src/app/api/admin/users/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import User from "@/lib/models/user";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";

// GET - Fetch all users (admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

// POST - Create a new user manually (admin only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, password, tier, durationDays } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password required" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Check if user exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 },
      );
    }

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const planNames: Record<string, string> = {
      free: "Free Trial",
      vip: "VIP Monthly",
      vvip: "VVIP Monthly",
    };

    const planExpiry = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : tier === "free"
        ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      tier: tier || "free",
      plan: planNames[tier] || "Free Trial",
      planExpiry,
      tradesUsed: 0,
      tradesLimit: tier === "free" ? 50 : 999999,
    });

    return NextResponse.json(
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          tier: user.tier,
          plan: user.plan,
          planExpiry: user.planExpiry,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST user error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
