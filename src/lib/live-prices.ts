// src/lib/live-prices.ts

import axios from "axios";

const FALLBACK_PRICES: Record<string, number> = {
  "EUR/USD": 1.085,
  "GBP/USD": 1.27,
  "USD/JPY": 148.5,
  "USD/CHF": 0.88,
  "AUD/USD": 0.66,
  "USD/CAD": 1.36,
  "NZD/USD": 0.61,
  "EUR/GBP": 0.855,
  "EUR/JPY": 161.0,
  "GBP/JPY": 188.5,
  "EUR/CHF": 0.955,
  "GBP/CHF": 1.118,
  "AUD/JPY": 98.0,
  "NZD/JPY": 90.5,
  "CAD/JPY": 109.0,
  "CHF/JPY": 168.5,
  "EUR/AUD": 1.645,
  "EUR/CAD": 1.475,
  "EUR/NZD": 1.78,
  "GBP/AUD": 1.925,
  "GBP/CAD": 1.728,
  "GBP/NZD": 2.085,
  "AUD/CAD": 0.898,
  "AUD/NZD": 1.082,
  "AUD/CHF": 0.581,
  "NZD/CAD": 0.83,
  "NZD/CHF": 0.537,
  "CAD/CHF": 0.647,
  "USD/SGD": 1.34,
  "USD/HKD": 7.82,
  "XAU/USD": 2350.0,
  "XAG/USD": 27.5,
  "BTC/USD": 67000.0,
  "ETH/USD": 3200.0,
};

export async function getRealTimePrice(pair: string): Promise<number> {
  // Try multiple free APIs
  const apis = [
    {
      url: `https://api.frankfurter.app/latest?from=${pair.split("/")[0]}&to=${pair.split("/")[1]}`,
      parser: (data: any) => data.rates?.[pair.split("/")[1]],
    },
    {
      url: `https://api.exchangerate-api.com/v4/latest/${pair.split("/")[0]}`,
      parser: (data: any) => data.rates?.[pair.split("/")[1]],
    },
  ];

  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { timeout: 5000 });
      const price = api.parser(response.data);
      if (price && price > 0) {
        return price;
      }
    } catch (error) {
      continue;
    }
  }

  return FALLBACK_PRICES[pair] || 1.0;
}

export { FALLBACK_PRICES };
