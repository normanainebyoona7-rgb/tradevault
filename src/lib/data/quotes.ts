export type QuoteSource = "swissquote" | "kraken" | "binance";

export interface LiveQuote {
  price: number;
  bid: number;
  ask: number;
  time: number;
  fetchedAt: number;
  source: QuoteSource;
}

function createQuote(
  source: QuoteSource,
  bidValue: unknown,
  askValue: unknown
): LiveQuote | null {
  const bid = Number(bidValue);
  const ask = Number(askValue);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
    return null;
  }

  const fetchedAt = Date.now();
  return {
    price: (bid + ask) / 2,
    bid,
    ask,
    time: Math.floor(fetchedAt / 1000),
    fetchedAt,
    source,
  };
}

export async function getSwissquoteQuote(pair: string): Promise<LiveQuote | null> {
  const upper = pair.toUpperCase();
  if (upper.startsWith("BTC") || upper.startsWith("ETH")) return null;

  const [base, quote] = upper.split("/");
  if (!base || !quote) return null;

  const url =
    "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/" +
    `${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;

    const json: any = await response.json();
    const row = Array.isArray(json) ? json[0] : null;
    const profile =
      row?.spreadProfilePrices?.find(
        (item: any) => item?.spreadProfile === "Standard"
      ) ?? row?.spreadProfilePrices?.[0];

    return createQuote("swissquote", profile?.bid, profile?.ask);
  } catch {
    return null;
  }
}

export async function getKrakenQuote(pair: string): Promise<LiveQuote | null> {
  const base = pair.split("/")[0]?.toUpperCase();
  if (base !== "BTC" && base !== "ETH") return null;

  const symbol = base === "BTC" ? "XBTUSD" : "ETHUSD";
  try {
    const response = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${symbol}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) return null;

    const json: any = await response.json();
    if (json?.error?.length) return null;
    const row = Object.values(json?.result ?? {})[0] as any;
    return createQuote("kraken", row?.b?.[0], row?.a?.[0]);
  } catch {
    return null;
  }
}

export async function getBinanceQuote(pair: string): Promise<LiveQuote | null> {
  const base = pair.split("/")[0]?.toUpperCase();
  if (base !== "BTC" && base !== "ETH") return null;

  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${base}USDT`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!response.ok) return null;

    const json: any = await response.json();
    return createQuote("binance", json?.bidPrice, json?.askPrice);
  } catch {
    return null;
  }
}

export async function getLiveQuote(pair: string): Promise<LiveQuote | null> {
  const swissquote = await getSwissquoteQuote(pair);
  if (swissquote) return swissquote;

  const kraken = await getKrakenQuote(pair);
  if (kraken) return kraken;

  return getBinanceQuote(pair);
}
