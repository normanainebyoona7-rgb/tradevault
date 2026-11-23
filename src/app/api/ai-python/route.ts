// src/app/api/ai-python/route.ts
// Proxy to the external Python AI service.
// Admin kill switch and user ban are enforced here as well, so the same
// rules apply whether the user hits /api/analyze-chart or /api/ai-python.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dbConnect } from "@/lib/db/mongodb";
import { getGlobalConfig } from "@/lib/models/config";
import User from "@/lib/models/user";

export async function POST(request: Request) {
  try {
    // 1. Require login
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Kill switch + ban enforcement
    try {
      await dbConnect();

      const cfg = await getGlobalConfig();
      if (!cfg.aiEnabled) {
        return NextResponse.json(
          {
            error: "AI disabled",
            message:
              cfg.aiDisabledMessage ||
              "AI analysis is temporarily disabled by the administrator.",
          },
          { status: 423 }
        );
      }

      const user: any = await User.findOne({
        email: String(session.email ?? "").toLowerCase(),
      })
        .select("banned bannedReason")
        .lean();

      if (user?.banned) {
        return NextResponse.json(
          {
            error: "Account banned",
            message:
              user.bannedReason ||
              "Your account has been banned by the administrator.",
          },
          { status: 403 }
        );
      }
    } catch (e) {
      console.error("AI gate check failed (non-fatal):", e);
    }

    // 3. Forward to Python service
    const contentType = request.headers.get("content-type") || "";
    const pythonUrl =
      process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const response = await fetch(`${pythonUrl}/api/analyze-image`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      return NextResponse.json(data);
    }

    const body = await request.json();
    const response = await fetch(`${pythonUrl}/api/get-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Python AI error:", error);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 500 }
    );
  }
}