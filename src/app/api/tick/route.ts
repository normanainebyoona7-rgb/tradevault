// src/app/api/tick/route.ts
// Lightweight real-time tick for the live chart.
//   1. Swissquote public BBO feed  — true FX/metal bid/ask (no key), polled every few seconds
//   2. Yahoo Finance 1m chart     — fallback, covers crypto and any instrument Swissquote lacks
// Returns price: null on failure. Never invents a price.

import { NextResponse } from "next/server";
import { toYahooSymbol } from "@/lib/data/candles";

export interface TickResponse {
  pair: string;
  price: number | null;
  time: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  bid: number | null;
  ask: number | null;
  source: "swissquote" | "yahoo" | "none";
  fetchedAt: number;
}

const cache = new Map<string, { at: number; payload: TickResponse }>();
const TTL_MS = 1500;

async function fetchSwissquote(
  pair: string
): Promise<{ price: number; bid: number; ask: number } | null> {
  const upper = pair.toUpperCase();
  if (upper.startsWith("BTC") || upper.startsWith("ETH")) return null;

  const [base, quote] = upper.split("/");
  if (!base || !quote) return null;

  const url =
    "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/" +
    `${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const json: any = await res.json();
    const row = Array.isArray(json) ? json[0] : null;
    const profile =
      row?.spreadProfilePrices?.find(
        (p: any) => p?.spreadProfile === "Standard"
      ) ?? row?.spreadProfilePrices?.[0];

    const bid = Number(profile?.bid);
    const ask = Number(profile?.ask);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
      return null;
    }

    return { price: (bid + ask) / 2, bid, ask };
  } catch {
    return null;
  }
}

async function fetchYahooTick(pair: string): Promise<Partial<TickResponse> | null> {
  const symbol = toYahooSymbol(pair);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1m&range=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const lastIndex = timestamps.length - 1;
    const lastClose = lastIndex >= 0 ? quote.close?.[lastIndex] : null;

    const price = Number(meta.regularMarketPrice ?? lastClose);
    if (!Number.isFinite(price) || price <= 0) return null;

    return {
      price,
      time: lastIndex >= 0 ? Number(timestamps[lastIndex]) : null,
      open: lastIndex >= 0 ? Number(quote.open?.[lastIndex] ?? price) : price,
      high: lastIndex >= 0 ? Number(quote.high?.[lastIndex] ?? price) : price,
      low: lastIndex >= 0 ? Number(quote.low?.[lastIndex] ?? price) : price,
      close: lastIndex >= 0 ? Number(lastClose ?? price) : price,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair") || "EUR/USD";

  const cached = cache.get(pair);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  const payload: TickResponse = {
    pair,
    price: null,
    time: null,
    open: null,
    high: null,
    low: null,
    close: null,
    bid: null,
    ask: null,
    source: "none",
    fetchedAt: Date.now(),
  };

  const sq = await fetchSwissquote(pair);
  if (sq) {
    payload.price = sq.price;
    payload.bid = sq.bid;
    payload.ask = sq.ask;
    payload.time = Math.floor(Date.now() / 1000);
    payload.close = sq.price;
    payload.source = "swissquote";
  } else {
    const yahoo = await fetchYahooTick(pair);
    if (yahoo?.price) {
      Object.assign(payload, yahoo, { source: "yahoo" });
    }
  }

  payload.fetchedAt = Date.now();
  cache.set(pair, { at: payload.fetchedAt, payload });
  return NextResponse.json(payload);
}
