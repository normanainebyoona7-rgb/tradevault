"use client";

import { useEffect, useRef, useState } from "react";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

export function TradingViewChart({
  onPairChange,
  onTimeframeChange,
  initialPair,
  initialTimeframe,
}: {
  onPairChange?: (pair: string) => void;
  onTimeframeChange?: (tf: string) => void;
  initialPair?: string;
  initialTimeframe?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPair, setSelectedPair] = useState(initialPair || "XAU/USD");
  const [timeframe, setTimeframe] = useState(initialTimeframe || "1H");

  // Sync with parent if initial values change
  useEffect(() => {
    if (initialPair && initialPair !== selectedPair) {
      setSelectedPair(initialPair);
    }
  }, [initialPair]);

  useEffect(() => {
    if (initialTimeframe && initialTimeframe !== timeframe) {
      setTimeframe(initialTimeframe);
    }
  }, [initialTimeframe]);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container";
    widgetDiv.style.width = "100%";
    widgetDiv.style.height = "400px";

    const innerDiv = document.createElement("div");
    innerDiv.className = "tradingview-widget-container__widget";
    innerDiv.style.width = "100%";
    innerDiv.style.height = "100%";

    widgetDiv.appendChild(innerDiv);
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `OANDA:${selectedPair.replace("/", "")}`,
      interval: timeframe,
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    widgetDiv.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [selectedPair, timeframe]);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "12px",
        borderBottom: "1px solid #e5e7eb",
        background: "#f9fafb",
      }}>
        <select
          value={selectedPair}
          onChange={(e) => {
            setSelectedPair(e.target.value);
            if (onPairChange) onPairChange(e.target.value);
          }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontWeight: "600" }}
        >
          {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeframe(tf);
                if (onTimeframeChange) onTimeframeChange(tf);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: timeframe === tf ? "#1c69e3" : "#e5e7eb",
                color: timeframe === tf ? "#fff" : "#6b7280",
                fontSize: "12px",
                fontWeight: timeframe === tf ? "700" : "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} style={{ width: "100%", height: "400px" }} />
    </div>
  );
}