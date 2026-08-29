// src/app/api/session/route.ts

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import User from "@/lib/models/user";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ user: null });
    }

    // Fetch user tier from database
    await dbConnect();
    const user = await User.findById(session.id).lean();

    return NextResponse.json({
      user: {
        id: session.id,
        name: session.name || (user as any)?.name || "",
        email: session.email || (user as any)?.email || "",
        tier: (user as any)?.tier || "free",
      },
    });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null });
  }
}