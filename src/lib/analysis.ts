import {
  TIMEFRAME_SECONDS,
  getCandlesFromYahoo,
  type Candle,
  type CandleSource,
} from "@/lib/data/candles";
import { getSwissquoteQuote, type LiveQuote } from "@/lib/data/quotes";

export interface ChartPriceSample {
  price: number;
  source: CandleSource;
  timeframe: string;
  time: number;
  rawPrice?: number;
}

export interface VerifiedPrice {
  ok: boolean;
  price: number;
  chartPrice: number;
  yahooPrice: number | null;
  dukascopyPrice: number | null;
  swissquotePrice: number | null;
  primarySource: CandleSource;
  comparisonSource: "yahoo" | "swissquote" | null;
  chartTime: number;
  comparisonTime: number | null;
  diffPct: number;
  tolerance: number;
  fetchedAt: number;
  reason?: string;
}

export function priceTolerancePct(pair: string): number {
  const upper = pair.toUpperCase();
  if (upper.includes("XAU") || upper.includes("XAG")) return 0.5;
  if (upper.startsWith("BTC") || upper.startsWith("ETH")) return 0.25;
  return 0.1;
}

function closestCandle(candles: Candle[], time: number): Candle | null {
  let closest: Candle | null = null;
  let distance = Infinity;
  for (const candle of candles) {
    const nextDistance = Math.abs(candle.time - time);
    if (nextDistance < distance) {
      closest = candle;
      distance = nextDistance;
    }
  }
  return closest;
}

function maxQuoteAgeMs(timeframe: string): number {
  const interval = (TIMEFRAME_SECONDS[timeframe] ?? 3600) * 1000;
  if (timeframe === "1m") return interval * 5;
  if (timeframe === "5m") return interval * 3;
  if (timeframe === "15m") return interval * 2;
  if (timeframe === "30m") return interval * 3;
  if (timeframe === "1H") return interval * 3;
  if (timeframe === "4H") return interval * 3;
  return interval * 3;
}

function result(args: {
  sample: ChartPriceSample;
  ok: boolean;
  comparisonPrice: number | null;
  comparisonSource: VerifiedPrice["comparisonSource"];
  comparisonTime: number | null;
  tolerance: number;
  yahooPrice?: number | null;
  dukascopyPrice?: number | null;
  swissquotePrice?: number | null;
  reason?: string;
}): VerifiedPrice {
  const diffPct =
    args.comparisonPrice == null
      ? 100
      : (Math.abs(args.sample.price - args.comparisonPrice) / args.sample.price) * 100;

  return {
    ok: args.ok,
    price: args.sample.price,
    chartPrice: args.sample.price,
    yahooPrice:
      args.yahooPrice ??
      (args.sample.source === "yahoo"
        ? args.sample.rawPrice ?? args.sample.price
        : args.comparisonSource === "yahoo"
          ? args.comparisonPrice
          : null),
    dukascopyPrice:
      args.dukascopyPrice ??
      (args.sample.source === "dukascopy" ? args.sample.price : null),
    swissquotePrice: args.swissquotePrice ?? null,
    primarySource: args.sample.source,
    comparisonSource: args.comparisonSource,
    chartTime: args.sample.time,
    comparisonTime: args.comparisonTime,
    diffPct,
    tolerance: args.tolerance,
    fetchedAt: Date.now(),
    reason: args.reason,
  };
}

export async function getVerifiedPrice(
  pair: string,
  sample: ChartPriceSample
): Promise<VerifiedPrice> {
  const tolerance = priceTolerancePct(pair);
  const invalid =
    !Number.isFinite(sample.price) ||
    sample.price <= 0 ||
    !Number.isFinite(sample.time) ||
    !TIMEFRAME_SECONDS[sample.timeframe] ||
    (sample.source !== "dukascopy" && sample.source !== "yahoo");

  if (invalid) {
    return result({
      sample,
      ok: false,
      comparisonPrice: null,
      comparisonSource: null,
      comparisonTime: null,
      tolerance,
      reason: "Invalid server candle sample — cannot verify price",
    });
  }

  let yahooCandle: Candle | null = null;
  if (sample.source === "dukascopy") {
    const yahooCandles = await getCandlesFromYahoo(pair, sample.timeframe, 500);
    yahooCandle = closestCandle(yahooCandles, sample.time);
    const interval = TIMEFRAME_SECONDS[sample.timeframe];
    if (!yahooCandle || Math.abs(yahooCandle.time - sample.time) > interval / 2) {
      yahooCandle = null;
    }
  }

  let comparisonPrice: number | null = yahooCandle?.close ?? null;
  let comparisonSource: VerifiedPrice["comparisonSource"] = yahooCandle ? "yahoo" : null;
  let comparisonTime: number | null = yahooCandle?.time ?? null;
  let swissquote: LiveQuote | null = null;

  if (comparisonPrice == null) {
    swissquote = await getSwissquoteQuote(pair);
    if (swissquote) {
      comparisonPrice = swissquote.price;
      comparisonSource = "swissquote";
      comparisonTime = swissquote.time;
    }
  }

  if (comparisonPrice == null) {
    return result({
      sample,
      ok: false,
      comparisonPrice: null,
      comparisonSource: null,
      comparisonTime: null,
      tolerance,
      yahooPrice: sample.source === "yahoo" ? sample.rawPrice ?? sample.price : null,
      dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
      reason: "No independent price source is available — cannot cross-validate",
    });
  }

  if (comparisonSource === "swissquote" && comparisonTime != null) {
    const quoteAge = Date.now() - comparisonTime * 1000;
    const candleAge = Date.now() - (sample.time + TIMEFRAME_SECONDS[sample.timeframe]) * 1000;
    if (quoteAge > maxQuoteAgeMs(sample.timeframe)) {
      return result({
        sample,
        ok: false,
        comparisonPrice,
        comparisonSource,
        comparisonTime,
        tolerance,
        yahooPrice: sample.source === "yahoo" ? sample.rawPrice ?? sample.price : null,
        dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
        swissquotePrice: swissquote?.price ?? comparisonPrice,
        reason: `Independent quote is stale (${Math.round(quoteAge / 60000)} minutes old)`,
      });
    }
    if (candleAge > maxQuoteAgeMs(sample.timeframe)) {
      return result({
        sample,
        ok: false,
        comparisonPrice,
        comparisonSource,
        comparisonTime,
        tolerance,
        yahooPrice: sample.source === "yahoo" ? sample.rawPrice ?? sample.price : null,
        dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
        swissquotePrice: swissquote?.price ?? comparisonPrice,
        reason: `Chart candle is too old for a live spot comparison (${Math.round(candleAge / 60000)} minutes old)`,
      });
    }
  }

  const diffPct = (Math.abs(sample.price - comparisonPrice) / sample.price) * 100;
  if (diffPct > tolerance) {
    return result({
      sample,
      ok: false,
      comparisonPrice,
      comparisonSource,
      comparisonTime,
      tolerance,
      yahooPrice: sample.source === "yahoo" ? sample.rawPrice ?? sample.price : yahooCandle?.close ?? null,
      dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
      swissquotePrice: swissquote?.price ?? null,
      reason: `Price mismatch: chart ${sample.price.toFixed(5)} vs ${comparisonSource} ${comparisonPrice.toFixed(5)} (${diffPct.toFixed(2)}% > ${tolerance}%)`,
    });
  }

  return result({
    sample,
    ok: true,
    comparisonPrice,
    comparisonSource,
    comparisonTime,
    tolerance,
    yahooPrice: sample.source === "yahoo" ? sample.rawPrice ?? sample.price : yahooCandle?.close ?? null,
    dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
    swissquotePrice: swissquote?.price ?? null,
  });
}
