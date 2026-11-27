import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/admin";
import { getVerifiedPrice } from "@/lib/analysis";
import { getCandlesWithSource, getClosedCandles } from "@/lib/data/candles";
import { computeOverlays } from "@/lib/overlays";
import { PAIRS } from "@/lib/pairs";
import { buildSignal } from "@/lib/signal";

const TIMEFRAMES = new Set(["1m", "5m", "15m", "30m", "1H", "4H", "1D"]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR/USD";
  const timeframe = searchParams.get("tf") || "1H";
  if (!PAIRS.includes(pair) || !TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: "Unsupported market", message: "Choose a supported pair and timeframe." },
      { status: 400 }
    );
  }

  const dataset = await getCandlesWithSource(pair, timeframe, 340);
  const candles = getClosedCandles(dataset.candles, timeframe).slice(-300);
  const latest = candles.at(-1);
  if (!latest) {
    return NextResponse.json({ error: "No closed candles" }, { status: 409 });
  }

  const verified = await getVerifiedPrice(pair, {
    price: latest.close,
    source: dataset.source,
    timeframe,
    time: latest.time,
  });
  const overlays = computeOverlays(pair, candles);
  return NextResponse.json(buildSignal(pair, timeframe, candles, overlays, verified));
}
