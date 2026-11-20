// src/lib/pairs.ts
// Single source of truth for every tradable instrument in the app.

export interface PairGroup {
  label: string;
  pairs: string[];
}

export const PAIR_GROUPS: PairGroup[] = [
  {
    label: "Majors",
    pairs: [
      "EUR/USD",
      "GBP/USD",
      "USD/JPY",
      "USD/CHF",
      "USD/CAD",
      "AUD/USD",
      "NZD/USD",
    ],
  },
  {
    label: "EUR crosses",
    pairs: [
      "EUR/GBP",
      "EUR/JPY",
      "EUR/CHF",
      "EUR/AUD",
      "EUR/CAD",
      "EUR/NZD",
    ],
  },
  {
    label: "GBP crosses",
    pairs: [
      "GBP/JPY",
      "GBP/CHF",
      "GBP/AUD",
      "GBP/CAD",
      "GBP/NZD",
    ],
  },
  {
    label: "JPY crosses",
    pairs: ["AUD/JPY", "NZD/JPY", "CAD/JPY", "CHF/JPY"],
  },
  {
    label: "Other crosses",
    pairs: [
      "AUD/CAD",
      "AUD/NZD",
      "AUD/CHF",
      "NZD/CAD",
      "NZD/CHF",
      "CAD/CHF",
    ],
  },
  {
    label: "Metals",
    pairs: ["XAU/USD", "XAG/USD"],
  },
  {
    label: "Crypto",
    pairs: ["BTC/USD", "ETH/USD"],
  },
];

export const PAIRS: string[] = PAIR_GROUPS.flatMap((g) => g.pairs);

export function isMetal(pair: string): boolean {
  const upper = pair.toUpperCase();
  return upper.includes("XAU") || upper.includes("XAG");
}

export function isCrypto(pair: string): boolean {
  const upper = pair.toUpperCase();
  return upper.startsWith("BTC") || upper.startsWith("ETH");
}

export function quoteCurrency(pair: string): string {
  return pair.split("/")[1] ?? "";
}

// Pip size used for risk/reward math across the app.
export function pipSize(pair: string): number {
  if (pair.includes("XAU")) return 0.1;
  if (pair.includes("XAG")) return 0.01;
  if (pair.includes("BTC")) return 1.0;
  if (pair.includes("ETH")) return 0.1;
  if (quoteCurrency(pair) === "JPY") return 0.01;
  return 0.0001;
}

export function pipValuePerLot(pair: string): number {
  if (pair.includes("XAU")) return 10;
  if (pair.includes("XAG")) return 50;
  if (pair.includes("BTC")) return 1;
  if (pair.includes("ETH")) return 1;
  if (quoteCurrency(pair) === "JPY") return 9.5;
  return 10;
}

export function priceDecimals(pair: string): number {
  if (pair.includes("XAU")) return 2;
  if (pair.includes("XAG")) return 3;
  if (pair.includes("BTC")) return 2;
  if (pair.includes("ETH")) return 2;
  if (quoteCurrency(pair) === "JPY") return 3;
  return 5;
}

export function formatPrice(pair: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(priceDecimals(pair));
}
