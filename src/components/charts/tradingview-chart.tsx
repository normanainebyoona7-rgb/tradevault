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
  const [chartKey, setChartKey] = useState(0);
  const [loading, setLoading] = useState(true);

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

    setLoading(true);
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
    script.onload = () => {
      setLoading(false);
    };
    script.onerror = () => {
      setLoading(false);
    };
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
      hide_side_toolbar: false,
      withdateranges: true,
    });

    widgetDiv.appendChild(script);

    // Set a timeout to hide loading even if script doesn't fire onload
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [selectedPair, timeframe, chartKey]);

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    setChartKey(prev => prev + 1); // Force re-render
    if (onTimeframeChange) onTimeframeChange(tf);
  };

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
    setChartKey(prev => prev + 1); // Force re-render
    if (onPairChange) onPairChange(pair);
  };

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
          onChange={(e) => handlePairChange(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", fontWeight: "600" }}
        >
          {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
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

      <div ref={containerRef} style={{ width: "100%", height: "400px", position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f9fafb",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "40px",
                height: "40px",
                border: "4px solid #e5e7eb",
                borderTop: "4px solid #1c69e3",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 12px",
              }} />
              <p style={{ color: "#6b7280", fontSize: "14px" }}>
                Loading {selectedPair} {timeframe} chart...
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}