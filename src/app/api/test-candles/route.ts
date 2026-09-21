// src/app/api/test-candles/route.ts
import { NextResponse } from "next/server";
import { getCandles } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR/USD";
  const tf = searchParams.get("tf") || "15m";
  const includeOverlays = searchParams.get("overlays") === "1";

  const candles = await getCandles(pair, tf, 300);

  if (!includeOverlays) {
    return NextResponse.json({
      pair,
      timeframe: tf,
      count: candles.length,
      candles,
    });
  }

  // Compute overlays only if we have candles
  const overlays =
    candles.length > 0 ? computeOverlays(pair, candles) : null;

  return NextResponse.json({
    pair,
    timeframe: tf,
    count: candles.length,
    candles,
    overlays,
  });
}