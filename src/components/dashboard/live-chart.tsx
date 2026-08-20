"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const POPULAR_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  "EUR/JPY",
  "GBP/JPY",
  "EUR/GBP",
  "XAU/USD",
  "BTC/USD",
];

export function LiveChart() {
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("60");

  const symbol = selectedPair.includes("XAU")
    ? "OANDA:XAUUSD"
    : selectedPair.includes("BTC")
      ? "BITSTAMP:BTCUSD"
      : `OANDA:${selectedPair.replace("/", "")}`;

  const timeframes = [
    { label: "1m", value: "1" },
    { label: "5m", value: "5" },
    { label: "15m", value: "15" },
    { label: "30m", value: "30" },
    { label: "1H", value: "60" },
    { label: "4H", value: "240" },
    { label: "1D", value: "1D" },
    { label: "1W", value: "1W" },
  ];

  const chartUrl = useMemo(() => {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: timeframe,
      theme: "dark",
      style: "1",
      toolbar_bg: "f1f3f6",
      save_image: "false",
      details: "true",
      hotlist: "true",
      calendar: "true",
      studies: JSON.stringify([
        "MASimple@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies",
      ]),
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol, timeframe]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-primary" />
          Live Charts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pair Selector */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_PAIRS.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPair(pair)}
              className={cn(
                "text-xs font-medium transition-all",
                selectedPair === pair && "shadow-md",
              )}
            >
              {pair}
            </Button>
          ))}
        </div>

        {/* Timeframe Selector */}
        <div className="flex flex-wrap gap-1">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              variant={timeframe === tf.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeframe(tf.value)}
              className="text-xs h-7 px-2"
            >
              {tf.label}
            </Button>
          ))}
        </div>

        {/* TradingView Chart */}
        <div className="rounded-lg overflow-hidden border">
          <iframe
            src={chartUrl}
            width="100%"
            height="500"
            style={{ border: "none" }}
            title="TradingView Live Chart"
            allow="fullscreen"
          />
        </div>
      </CardContent>
    </Card>
  );
}
