// src/lib/data/candles.ts
// Hybrid candle source:
//   - Dukascopy for forex + crypto (free, no API key, real institutional data)
//   - Yahoo Finance fallback for metals (XAU, XAG) and anything Dukascopy doesn't cover
// Single source of truth for OHLC candles.
// Used by BOTH the chart widget AND the AI signal engine.

import { getHistoricalRates } from "dukascopy-node";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_green: boolean;
}

// ===== SYMBOL MAPPING =====

// Dukascopy's free feed covers forex + crypto but NOT spot metals.
// Metals go to Yahoo.
const YAHOO_ONLY = ["XAU", "XAG"];

function isYahooOnly(pair: string): boolean {
  const upper = pair.toUpperCase();
  return YAHOO_ONLY.some((m) => upper.includes(m));
}

function toDukascopySymbol(pair: string): string {
  return pair.replace("/", "").toLowerCase();
}

function toYahooSymbol(pair: string): string {
  const upper = pair.toUpperCase();

  if (upper.includes("XAU")) return "GC=F";
  if (upper.includes("XAG")) return "SI=F";
  if (upper.startsWith("BTC")) return "BTC-USD";
  if (upper.startsWith("ETH")) return "ETH-USD";

  const [base, quote] = upper.split("/");
  if (base && quote) return `${base}${quote}=X`;

  return "EURUSD=X";
}

// ===== TIMEFRAME MAPPING =====

type DukascopyTimeframe =
  | "m1"
  | "m5"
  | "m15"
  | "m30"
  | "h1"
  | "h4"
  | "d1"
  | "mn1";

interface DukascopyTfConfig {
  dukascopyTimeframe: DukascopyTimeframe;
  lookbackHours: number;
}

function timeframeToDukascopyConfig(timeframe: string): DukascopyTfConfig {
  const map: Record<string, DukascopyTfConfig> = {
    "1m": { dukascopyTimeframe: "m1", lookbackHours: 300 },
    "5m": { dukascopyTimeframe: "m5", lookbackHours: 1500 },
    "15m": { dukascopyTimeframe: "m15", lookbackHours: 4500 },
    "30m": { dukascopyTimeframe: "m30", lookbackHours: 9000 },
    "1H": { dukascopyTimeframe: "h1", lookbackHours: 18000 },
    "4H": { dukascopyTimeframe: "h4", lookbackHours: 72000 },
    "1D": { dukascopyTimeframe: "d1", lookbackHours: 7200 },
    "1W": { dukascopyTimeframe: "mn1", lookbackHours: 86400 },
  };
  return map[timeframe] || map["1H"];
}

type YahooInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk";

interface YahooTfConfig {
  yahooInterval: YahooInterval;
  resampleFactor: number;
  range: string;
}

function timeframeToYahooConfig(timeframe: string): YahooTfConfig {
  const map: Record<string, YahooTfConfig> = {
    "1m": { yahooInterval: "1m", resampleFactor: 1, range: "5d" },
    "5m": { yahooInterval: "5m", resampleFactor: 1, range: "1mo" },
    "15m": { yahooInterval: "15m", resampleFactor: 1, range: "1mo" },
    "30m": { yahooInterval: "30m", resampleFactor: 1, range: "1mo" },
    "1H": { yahooInterval: "60m", resampleFactor: 1, range: "3mo" },
    "4H": { yahooInterval: "60m", resampleFactor: 4, range: "6mo" },
    "1D": { yahooInterval: "1d", resampleFactor: 1, range: "2y" },
    "1W": { yahooInterval: "1wk", resampleFactor: 1, range: "5y" },
  };
  return map[timeframe] || map["1H"];
}

// ===== RESAMPLE (4H from 60m) =====

function resampleCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1) return candles;

  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    if (group.length === 0) continue;

    const open = group[0].open;
    const close = group[group.length - 1].close;
    const high = Math.max(...group.map((c) => c.high));
    const low = Math.min(...group.map((c) => c.low));
    const volume = group.reduce((s, c) => s + c.volume, 0);

    result.push({
      time: group[0].time,
      open,
      high,
      low,
      close,
      volume,
      is_green: close > open,
    });
  }
  return result;
}

// ===== DUKASCOPY FETCH =====

async function getCandlesFromDukascopy(
  pair: string,
  timeframe: string,
  count: number
): Promise<Candle[]> {
  const config = timeframeToDukascopyConfig(timeframe);
  const instrument = toDukascopySymbol(pair);

  const now = new Date();
  const from = new Date(now.getTime() - config.lookbackHours * 60 * 60 * 1000);

  try {
    const rawData: any = await Promise.race([
      getHistoricalRates({
        instrument: instrument as any,
        dates: { from, to: now },
        timeframe: config.dukascopyTimeframe as any,
        format: "json",
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Dukascopy fetch timeout (8s)")),
          8000
        )
      ),
    ]);

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.error(`[candles] Dukascopy: no data for ${pair} ${timeframe}`);
      return [];
    }

    const candles: Candle[] = rawData
      .filter(
        (d: any) =>
          d.open != null && d.high != null && d.low != null && d.close != null
      )
      .map((d: any) => {
        const open = Number(d.open);
        const close = Number(d.close);
        return {
          time: Math.floor(Number(d.timestamp) / 1000),
          open,
          high: Number(d.high),
          low: Number(d.low),
          close,
          volume: Number(d.volume ?? 0),
          is_green: close > open,
        };
      });

    if (candles.length === 0) {
      console.error(`[candles] Dukascopy: zero valid candles ${pair} ${timeframe}`);
      return [];
    }

    return candles.slice(-count);
  } catch (e: any) {
    console.error(
      `[candles] Dukascopy fetch failed ${pair} ${timeframe}: ${e?.message}`
    );
    return [];
  }
}

// ===== YAHOO FETCH =====

async function getCandlesFromYahoo(
  pair: string,
  timeframe: string,
  count: number
): Promise<Candle[]> {
  const config = timeframeToYahooConfig(timeframe);
  const symbol = toYahooSymbol(pair);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${config.yahooInterval}&range=${config.range}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[candles] Yahoo HTTP ${res.status} for ${pair} ${timeframe}`);
      return [];
    }

    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      console.error(`[candles] Yahoo: no chart result for ${pair} ${timeframe}`);
      return [];
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};

    const opens: (number | null)[] = quote.open ?? [];
    const highs: (number | null)[] = quote.high ?? [];
    const lows: (number | null)[] = quote.low ?? [];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    if (timestamps.length === 0) {
      console.error(`[candles] Yahoo: empty timestamps ${pair} ${timeframe}`);
      return [];
    }

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      if (o == null || h == null || l == null || c == null) continue;

      const open = Number(o);
      const close = Number(c);
      candles.push({
        time: Number(timestamps[i]),
        open,
        high: Number(h),
        low: Number(l),
        close,
        volume: Number(volumes[i] ?? 0),
        is_green: close > open,
      });
    }

    if (candles.length === 0) {
      console.error(`[candles] Yahoo: zero valid candles ${pair} ${timeframe}`);
      return [];
    }

    const resampled = resampleCandles(candles, config.resampleFactor);
    return resampled.slice(-count);
  } catch (e: any) {
    console.error(
      `[candles] Yahoo fetch failed ${pair} ${timeframe}: ${e?.message}`
    );
    return [];
  }
}

// ===== MAIN FETCH =====

export async function getCandles(
  pair: string,
  timeframe: string,
  count: number = 300
): Promise<Candle[]> {
  // Metals → Yahoo (Dukascopy free tier doesn't cover them)
  if (isYahooOnly(pair)) {
    console.log(`[candles] ${pair} → Yahoo (metal)`);
    return getCandlesFromYahoo(pair, timeframe, count);
  }

  // Try Dukascopy first
  const duka = await getCandlesFromDukascopy(pair, timeframe, count);
  if (duka.length > 0) {
    return duka;
  }

  // Fall back to Yahoo
  console.log(`[candles] ${pair} Dukascopy empty → Yahoo fallback`);
  const yahoo = await getCandlesFromYahoo(pair, timeframe, count);
  return yahoo;
}

// ===== HELPER: latest price only =====

export async function getLatestPrice(pair: string): Promise<number | null> {
  const candles = await getCandles(pair, "1H", 1);
  if (candles.length === 0) return null;
  return candles[candles.length - 1].close;
}