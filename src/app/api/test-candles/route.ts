import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { TIMEFRAME_SECONDS, getCandlesWithSource } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { PAIRS } from "@/lib/pairs";

const TIMEFRAMES = new Set(Object.keys(TIMEFRAME_SECONDS));

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR/USD";
  const timeframe = searchParams.get("tf") || "15m";
  const includeOverlays = searchParams.get("overlays") === "1";

  if (!PAIRS.includes(pair) || !TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: "Unsupported market", message: "Choose a supported pair and timeframe." },
      { status: 400 }
    );
  }

  const dataset = await getCandlesWithSource(pair, timeframe, 300);
  const overlays =
    includeOverlays && dataset.candles.length > 0
      ? computeOverlays(pair, dataset.candles)
      : null;

  return NextResponse.json({
    pair,
    timeframe,
    count: dataset.candles.length,
    candles: dataset.candles,
    overlays,
    source: dataset.source,
    basisAdjustment: dataset.basisAdjustment,
    fetchedAt: dataset.fetchedAt,
  });
}
