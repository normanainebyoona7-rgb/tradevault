// src/lib/forex-data.ts
// Support library only — price fetching, pip sizes, spreads.
// Signal generation is now in smc-from-image.ts (pure SMC).

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const FALLBACK_PRICES: Record<string, number> = {
  "EUR/USD": 1.0850,
  "GBP/USD": 1.2700,
  "USD/JPY": 148.50,
  "XAU/USD": 2400.00,
  "XAG/USD": 28.50,
  "BTC/USD": 67000.00,
  "ETH/USD": 3200.00,
  "GBP/JPY": 188.50,
};

const EXNESS_SPREADS: Record<string, number> = {
  "EUR/USD": 1,
  "GBP/USD": 1.5,
  "USD/JPY": 1.2,
  "XAU/USD": 50,
  "XAG/USD": 30,
  "BTC/USD": 100,
  "ETH/USD": 20,
  "GBP/JPY": 2.5,
};

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD"];
const METAL_PAIRS = ["XAU/USD", "XAG/USD"];

// ===== PIP SIZE =====

export function calculatePipSize(pair: string): number {
  const [, quote] = pair.split("/");
  if (pair.includes("XAU")) return 0.10;
  if (pair.includes("XAG")) return 0.01;
  if (pair.includes("BTC")) return 1.00;
  if (pair.includes("ETH")) return 0.10;
  if (quote === "JPY") return 0.01;
  return 0.0001;
}

// ===== SPREAD =====

export function getExnessSpread(pair: string): number {
  return EXNESS_SPREADS[pair] || 2;
}

// ===== SYMBOL MAPPING =====

function toYahooSymbol(pair: string): string {
  const symbols: Record<string, string> = {
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "JPY=X",
    "XAU/USD": "GC=F",
    "XAG/USD": "SI=F",
    "BTC/USD": "BTC-USD",
    "ETH/USD": "ETH-USD",
    "GBP/JPY": "GBPJPY=X",
  };
  return symbols[pair] || "EURUSD=X";
}

function timeframeToYahooInterval(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1H": "1h",
    "4H": "4h",
    "1D": "1d",
    "1W": "1wk",
  };
  return map[timeframe] || "1h";
}

function shouldUseYahoo(pair: string, timeframe: string): boolean {
  if (CRYPTO_PAIRS.includes(pair)) return ["1H", "4H", "1D", "1W"].includes(timeframe);
  if (METAL_PAIRS.includes(pair)) return true;
  return false;
}

// ===== PRICE FETCHING =====

async function fetchFromFCS(pair: string): Promise<number | null> {
  try {
    const url = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const r = await fetch(`${url}/api/get-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair }),
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.price && d.price > 0) return d.price;
    }
  } catch (e: any) {
    console.error(`FCS price failed ${pair}: ${e?.message}`);
  }
  return null;
}

async function fetchFromYahoo(pair: string, timeframe: string): Promise<number | null> {
  try {
    const symbol = toYahooSymbol(pair);
    const interval = timeframeToYahooInterval(timeframe);
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: interval as any,
    });
    if (result.quotes && result.quotes.length > 0) {
      const prices = result.quotes.filter(q => q.close != null).map(q => Number(q.close));
      if (prices.length > 0) return prices[prices.length - 1];
    }
  } catch (e: any) {
    console.error(`Yahoo price failed ${pair}: ${e?.message}`);
  }
  return null;
}

export async function getLivePrice(pair: string, timeframe: string = "1H"): Promise<number> {
  const useYahoo = shouldUseYahoo(pair, timeframe);

  if (useYahoo) {
    const y = await fetchFromYahoo(pair, timeframe);
    if (y !== null) return y;
    const f = await fetchFromFCS(pair);
    if (f !== null) return f;
  } else {
    const f = await fetchFromFCS(pair);
    if (f !== null) return f;
    const y = await fetchFromYahoo(pair, timeframe);
    if (y !== null) return y;
  }

  // If both fail, return fallback (used only for display, not analysis)
  return FALLBACK_PRICES[pair] || 1.0;
}

// ===== CLOSE-ONLY HISTORY (used by multi-timeframe.ts for trend confirmation only) =====

async function fetchHistoryFromFCS(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const url = process.env.PYTHON_AI_URL || "https://tradevault-ai.onrender.com";
    const r = await fetch(`${url}/api/get-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, timeframe, limit: 200 }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.closes && d.closes.length >= 50) return d.closes;
    }
  } catch (e: any) {
    console.error(`FCS history failed ${pair}: ${e?.message}`);
  }
  return null;
}

async function fetchHistoryFromYahoo(pair: string, timeframe: string): Promise<number[] | null> {
  try {
    const symbol = toYahooSymbol(pair);
    const interval = timeframeToYahooInterval(timeframe);
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: interval as any,
    });
    if (result.quotes && result.quotes.length >= 50) {
      const prices = result.quotes.filter(q => q.close != null).map(q => Number(q.close));
      if (prices.length >= 50) return prices;
    }
  } catch (e: any) {
    console.error(`Yahoo history failed ${pair}: ${e?.message}`);
  }
  return null;
}

export async function getRealHistoricalData(
  pair: string,
  interval: string = "1H"
): Promise<{ prices: number[]; source: string } | null> {
  const useYahoo = shouldUseYahoo(pair, interval);

  if (useYahoo) {
    const y = await fetchHistoryFromYahoo(pair, interval);
    if (y) return { prices: y, source: "yahoo" };
    const f = await fetchHistoryFromFCS(pair, interval);
    if (f) return { prices: f, source: "fcs" };
  } else {
    const f = await fetchHistoryFromFCS(pair, interval);
    if (f) return { prices: f, source: "fcs" };
    const y = await fetchHistoryFromYahoo(pair, interval);
    if (y) return { prices: y, source: "yahoo" };
  }

  // No synthetic fallback
  return null;
}

// ===== CONTRACT / VALUE HELPERS =====

export function getPipValue(pair: string, contractSize: number): number {
  return calculatePipSize(pair) * contractSize;
}

export { FALLBACK_PRICES, EXNESS_SPREADS };