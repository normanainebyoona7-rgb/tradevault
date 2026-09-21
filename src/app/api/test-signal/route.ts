// src/app/api/test-signal/route.ts
import { NextResponse } from "next/server";
import { getCandles } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { buildSignal } from "@/lib/signal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR/USD";
  const tf = searchParams.get("tf") || "1H";

  const candles = await getCandles(pair, tf, 300);

  if (candles.length === 0) {
    return NextResponse.json({ error: "No candles" });
  }

  const overlays = computeOverlays(pair, candles);
  const signal = buildSignal(pair, tf, candles, overlays);

  return NextResponse.json(signal);
}