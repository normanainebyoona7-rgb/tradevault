"use client";

import { useEffect, useState, useRef } from "react";

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
  "XAU/USD": 2350.0,
  "BTC/USD": 67000.0,
  "ETH/USD": 3200.0,
};

export function useRealtimePrice(pair: string) {
  const [price, setPrice] = useState<number>(FALLBACK_PRICES[pair] || 1.0);
  const [previousPrice, setPreviousPrice] = useState<number>(
    FALLBACK_PRICES[pair] || 1.0,
  );
  const priceRef = useRef<number>(FALLBACK_PRICES[pair] || 1.0);

  useEffect(() => {
    const fallback = FALLBACK_PRICES[pair] || 1.0;
    setPrice(fallback);
    setPreviousPrice(fallback);
    priceRef.current = fallback;

    const interval = setInterval(() => {
      const basePrice = FALLBACK_PRICES[pair] || 1.0;
      const volatility = basePrice * 0.0005;
      const change = (Math.random() - 0.5) * volatility;
      const newPrice = priceRef.current + change;

      const minPrice = basePrice * 0.98;
      const maxPrice = basePrice * 1.02;
      const clampedPrice = Math.min(Math.max(newPrice, minPrice), maxPrice);

      setPreviousPrice(priceRef.current);
      setPrice(clampedPrice);
      priceRef.current = clampedPrice;
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [pair]);

  const isPriceUp = price >= previousPrice;

  return { price, previousPrice, isPriceUp };
}
