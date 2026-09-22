// src/lib/analysis.ts
// Cross-validates price from TWO sources: Dukascopy (chart candles) and Yahoo.
// Returns a verified price only if both agree within tolerance.
// If they disagree, the signal engine refuses to fire.

import { getCandles } from "@/lib/data/candles";

export interface VerifiedPrice {
  ok: boolean;
  price: number;           // verified price (chart) if ok, else latest chart price
  chartPrice: number;      // last candle close from candles.ts
  yahooPrice: number | null;
  dukascopyPrice: number | null;
  diffPct: number;         // percent difference between sources
  tolerance: number;       // tolerance used (as percent)
  reason?: string;
}

// ===== TOLERANCE =====
// 0.1% — roughly $4 on gold, 10 pips on EUR/USD
export function priceTolerancePct(): number {
  return 0.1;
}

// ===== YAHOO SYMBOL MAP =====

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

async function fetchYahooPrice(pair: string): Promise<number | null> {
  const symbol = toYahooSymbol(pair);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=1m&range=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json: any = await res.json();
    const result = json?.chart?.result?.[0];

    // Prefer meta.regularMarketPrice (most recent)
    const meta = result?.meta;
    if (meta?.regularMarketPrice) {
      return Number(meta.regularMarketPrice);
    }

    // Fallback: last non-null close in the quote array
    const closes: (number | null)[] | undefined =
      result?.indicators?.quote?.[0]?.close;

    if (closes) {
      for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] != null) return Number(closes[i]);
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ===== MAIN =====

export async function getVerifiedPrice(pair: string): Promise<VerifiedPrice> {
  const tolerance = priceTolerancePct();

  // Chart price = last 1m candle close from Dukascopy
  const chartCandles = await getCandles(pair, "1m", 1);
  const chartPrice =
    chartCandles.length > 0 ? chartCandles[chartCandles.length - 1].close : 0;

  // Yahoo price = independent second source
  const yahooPrice = await fetchYahooPrice(pair);

  // Chart data missing
  if (chartPrice === 0) {
    return {
      ok: false,
      price: 0,
      chartPrice: 0,
      yahooPrice,
      dukascopyPrice: null,
      diffPct: 100,
      tolerance,
      reason: "Chart price unavailable (no candles from Dukascopy)",
    };
  }

  // Yahoo unavailable — cannot verify, but return chart price flagged as not-verified
  if (yahooPrice === null) {
    return {
      ok: false,
      price: chartPrice,
      chartPrice,
      yahooPrice: null,
      dukascopyPrice: chartPrice,
      diffPct: 0,
      tolerance,
      reason: "Yahoo price unavailable — cannot cross-validate",
    };
  }

  const diffPct = (Math.abs(chartPrice - yahooPrice) / chartPrice) * 100;

  if (diffPct <= tolerance) {
    return {
      ok: true,
      price: chartPrice,
      chartPrice,
      yahooPrice,
      dukascopyPrice: chartPrice,
      diffPct,
      tolerance,
    };
  }

  return {
    ok: false,
    price: chartPrice,
    chartPrice,
    yahooPrice,
    dukascopyPrice: chartPrice,
    diffPct,
    tolerance,
    reason: `Price mismatch: chart ${chartPrice.toFixed(5)} vs Yahoo ${yahooPrice.toFixed(5)} (${diffPct.toFixed(2)}% > ${tolerance}%)`,
  };
}