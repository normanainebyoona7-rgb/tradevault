import { NextResponse } from "next/server";
import {
  isExecutorAuthorized,
  isExecutorConfigured,
} from "@/lib/broker/executor-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isExecutorConfigured() || !isExecutorAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error: "Unclaimed polling is disabled. Use POST /api/executor/claim.",
      reason: "Prevents duplicate orders from non-atomic signal polling.",
    },
    { status: 410 }
  );
}
