export interface LiveQuote {
  price: number;
  bid: number;
  ask: number;
  time: number;
  fetchedAt: number;
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

    const bid = Number(profile?.bid);
    const ask = Number(profile?.ask);
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
    };
  } catch {
    return null;
  }
}
