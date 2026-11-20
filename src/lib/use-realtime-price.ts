"use client";

import { useEffect, useRef, useState } from "react";

// Real ticks only — polls /api/tick (Swissquote FX/metals, Yahoo crypto).
// Returns null until the first quote arrives; never invents a price.
export function useRealtimePrice(pair: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const priceRef = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;

    priceRef.current = null;
    setPrice(null);
    setPreviousPrice(null);

    const poll = async () => {
      try {
        const res = await fetch(`/api/tick?pair=${encodeURIComponent(pair)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const next = Number(json?.price);
        if (!Number.isFinite(next) || next <= 0 || stopped) return;

        setPreviousPrice(priceRef.current);
        priceRef.current = next;
        setPrice(next);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [pair]);

  const isPriceUp =
    price != null && previousPrice != null ? price >= previousPrice : true;

  return { price, previousPrice, isPriceUp };
}
