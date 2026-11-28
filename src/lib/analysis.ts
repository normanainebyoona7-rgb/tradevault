import {
  TIMEFRAME_SECONDS,
  getCandlesFromYahoo,
  type Candle,
  type CandleSource,
} from "@/lib/data/candles";
import {
  getBinanceQuote,
  getKrakenQuote,
  getSwissquoteQuote,
  type LiveQuote,
} from "@/lib/data/quotes";

export interface ChartPriceSample {
  price: number;
  source: CandleSource;
  timeframe: string;
  time: number;
  rawPrice?: number;
}

export type ComparisonSource = "yahoo" | "swissquote" | "kraken" | "binance";

export interface VerifiedPrice {
  ok: boolean;
  price: number;
  chartPrice: number;
  comparisonPrice: number | null;
  yahooPrice: number | null;
  dukascopyPrice: number | null;
  swissquotePrice: number | null;
  primarySource: CandleSource;
  comparisonSource: ComparisonSource | null;
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

export function liveQuoteTolerancePct(pair: string, timeframe: string): number {
  const upper = pair.toUpperCase();
  const timeframeDrift: Record<string, number> = {
    "1m": 0.2,
    "5m": 0.25,
    "15m": 0.3,
    "30m": 0.4,
    "1H": 0.6,
    "4H": 1.25,
    "1D": 2.5,
  };
  const instrumentDrift =
    upper.includes("XAU") || upper.includes("XAG")
      ? 2.5
      : upper.startsWith("BTC") || upper.startsWith("ETH")
        ? 1
        : 0;
  return Math.max(
    priceTolerancePct(pair),
    timeframeDrift[timeframe] ?? 0.6,
    instrumentDrift
  );
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
    comparisonPrice: args.comparisonPrice,
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

  const interval = TIMEFRAME_SECONDS[sample.timeframe];
  const failures: string[] = [];
  let yahooCandle: Candle | null = null;

  if (sample.source === "dukascopy") {
    const yahooCandles = await getCandlesFromYahoo(pair, sample.timeframe, 500);
    yahooCandle = closestCandle(yahooCandles, sample.time);
    if (!yahooCandle || Math.abs(yahooCandle.time - sample.time) > interval / 2) {
      yahooCandle = null;
    }
  }

  const finish = (args: {
    ok: boolean;
    comparisonPrice: number | null;
    comparisonSource: ComparisonSource | null;
    comparisonTime: number | null;
    swissquotePrice?: number | null;
    tolerance?: number;
    reason?: string;
  }): VerifiedPrice =>
    result({
      sample,
      ...args,
      tolerance: args.tolerance ?? tolerance,
      yahooPrice:
        sample.source === "yahoo"
          ? sample.rawPrice ?? sample.price
          : yahooCandle?.close ?? null,
      dukascopyPrice: sample.source === "dukascopy" ? sample.price : null,
    });

  if (yahooCandle) {
    const candleAge = Date.now() - (yahooCandle.time + interval) * 1000;
    const diffPct =
      (Math.abs(sample.price - yahooCandle.close) / sample.price) * 100;

    if (candleAge > maxQuoteAgeMs(sample.timeframe)) {
      failures.push(
        `Independent Yahoo candle is stale (${Math.round(candleAge / 60000)} minutes old)`
      );
    } else if (diffPct > tolerance) {
      failures.push(
        `Price mismatch: chart ${sample.price.toFixed(5)} vs yahoo ${yahooCandle.close.toFixed(5)} (${diffPct.toFixed(2)}% > ${tolerance}%)`
      );
    } else {
      return finish({
        ok: true,
        comparisonPrice: yahooCandle.close,
        comparisonSource: "yahoo",
        comparisonTime: yahooCandle.time,
      });
    }
  }

  const upper = pair.toUpperCase();
  const providers =
    upper.startsWith("BTC") || upper.startsWith("ETH")
      ? [getKrakenQuote, getBinanceQuote]
      : [getSwissquoteQuote];
  let quoteAttempts = 0;

  for (const provider of providers) {
    const quote: LiveQuote | null = await provider(pair);
    if (!quote) continue;
    quoteAttempts += 1;

    const quoteAge = Date.now() - quote.time * 1000;
    const candleAge = Date.now() - (sample.time + interval) * 1000;
    const quoteTolerance = liveQuoteTolerancePct(pair, sample.timeframe);
    const diffPct =
      (Math.abs(sample.price - quote.price) / sample.price) * 100;

    if (quoteAge > 30_000) {
      failures.push(
        `Independent ${quote.source} quote is stale (${Math.round(quoteAge / 60000)} minutes old)`
      );
      continue;
    }
    if (candleAge > maxQuoteAgeMs(sample.timeframe)) {
      failures.push(
        `Chart candle is too old for a live spot comparison (${Math.round(candleAge / 60000)} minutes old)`
      );
      continue;
    }
    if (diffPct > quoteTolerance) {
      failures.push(
        `Price mismatch: chart ${sample.price.toFixed(5)} vs ${quote.source} ${quote.price.toFixed(5)} (${diffPct.toFixed(2)}% > ${quoteTolerance}%)`
      );
      continue;
    }

    return finish({
      ok: true,
      comparisonPrice: quote.price,
      comparisonSource: quote.source,
      comparisonTime: quote.time,
      swissquotePrice: quote.source === "swissquote" ? quote.price : null,
      tolerance: quoteTolerance,
    });
  }

  return finish({
    ok: false,
    comparisonPrice: null,
    comparisonSource: null,
    comparisonTime: null,
    reason:
      failures[0] ??
      (quoteAttempts === 0
        ? "No independent price source is available — cannot cross-validate"
        : "Independent price sources did not return a usable quote"),
  });
}
