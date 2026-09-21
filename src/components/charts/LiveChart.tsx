"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

const PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  "EUR/JPY",
  "GBP/JPY",
  "XAU/USD",
  "XAG/USD",
  "BTC/USD",
  "ETH/USD",
];

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_green: boolean;
}

interface Overlays {
  sdZones: any[];
  orderBlocks: any[];
  fvgs: any[];
  liquidityZones: any[];
  smcSupplyDemand: any[];
  sma9: { time: number; value: number }[];
  sma21: { time: number; value: number }[];
  sma200: { time: number; value: number }[];
  ema50: { time: number; value: number }[];
  vwap: { time: number; value: number }[];
  supertrend: { time: number; value: number; direction: "up" | "down" }[];
  rsi: { time: number; value: number }[];
  roundNumbers: { level: number; type: string }[];
  pivots: {
    pp: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  } | null;
  sessions: any[];
  largeRangeCandles: {
    time: number;
    price: number;
    direction: "bullish" | "bearish";
    rangePct: number;
  }[];
}

const EMPTY_OVERLAYS: Overlays = {
  sdZones: [],
  orderBlocks: [],
  fvgs: [],
  liquidityZones: [],
  smcSupplyDemand: [],
  sma9: [],
  sma21: [],
  sma200: [],
  ema50: [],
  vwap: [],
  supertrend: [],
  rsi: [],
  roundNumbers: [],
  pivots: null,
  sessions: [],
  largeRangeCandles: [],
};

export function LiveChart({
  onPairChange,
  onTimeframeChange,
  initialPair,
  initialTimeframe,
  onDataLoaded,
}: {
  onPairChange?: (pair: string) => void;
  onTimeframeChange?: (tf: string) => void;
  initialPair?: string;
  initialTimeframe?: string;
  onDataLoaded?: (info: { pair: string; timeframe: string; candleCount: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [selectedPair, setSelectedPair] = useState(initialPair || "EUR/USD");
  const [timeframe, setTimeframe] = useState(initialTimeframe || "1H");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleCount, setCandleCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);

  // Create charts on mount
  useEffect(() => {
    if (!containerRef.current || !rsiContainerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#374151",
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      width: containerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
      },
    });

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7280",
      },
      grid: {
        vertLines: { color: "#f9fafb" },
        horzLines: { color: "#f3f4f6" },
      },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        visible: false,
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
      },
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
    });

    chartRef.current = chart;
    rsiChartRef.current = rsiChart;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      rsiChart.remove();
      chartRef.current = null;
      rsiChartRef.current = null;
      seriesMapRef.current.clear();
      rsiSeriesRef.current = null;
    };
  }, []);

  // Load + render
  useEffect(() => {
    if (!chartRef.current || !rsiChartRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const render = async (isRefresh: boolean = false) => {
      try {
        const res = await fetch(
          `/api/test-candles?pair=${encodeURIComponent(selectedPair)}&tf=${timeframe}&overlays=1`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (cancelled) return;

        const candles: Candle[] = json.candles ?? [];
        const overlays: Overlays = json.overlays ?? EMPTY_OVERLAYS;

        if (candles.length === 0) {
          if (!isRefresh) {
            setError("No candle data returned");
            setCandleCount(0);
          }
          return;
        }

        const chart = chartRef.current!;
        const rsiChart = rsiChartRef.current!;

        // Clear old series
        for (const s of seriesMapRef.current.values()) {
          try {
            chart.removeSeries(s);
          } catch {}
        }
        seriesMapRef.current.clear();

        if (rsiSeriesRef.current) {
          try {
            rsiChart.removeSeries(rsiSeriesRef.current);
          } catch {}
          rsiSeriesRef.current = null;
        }

        // ===== CANDLES =====
        const candleSeries = chart.addCandlestickSeries({
          upColor: "#10b981",
          downColor: "#ef4444",
          borderUpColor: "#10b981",
          borderDownColor: "#ef4444",
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });
        candleSeries.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        seriesMapRef.current.set("candles", candleSeries);

        if (showOverlays) {
          const addLine = (
            key: string,
            data: { time: number; value: number }[],
            color: string,
            width: 1 | 2 | 3 = 1,
            style: LineStyle = LineStyle.Solid
          ) => {
            if (data.length === 0) return;
            const s = chart.addLineSeries({
              color,
              lineWidth: width,
              lineStyle: style,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(
              data.map((p) => ({
                time: p.time as UTCTimestamp,
                value: p.value,
              }))
            );
            seriesMapRef.current.set(key, s);
          };

          addLine("sma9", overlays.sma9, "#3b82f6", 1);
          addLine("sma21", overlays.sma21, "#f59e0b", 1);
          addLine("sma200", overlays.sma200, "#8b5cf6", 2);
          addLine("ema50", overlays.ema50, "#ec4899", 1);
          addLine("vwap", overlays.vwap, "#06b6d4", 1, LineStyle.Dashed);

          // Supertrend
          const upPoints = overlays.supertrend
            .filter((p) => p.direction === "up")
            .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
          const downPoints = overlays.supertrend
            .filter((p) => p.direction === "down")
            .map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

          if (upPoints.length > 0) {
            const s = chart.addLineSeries({
              color: "#10b981",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(upPoints);
            seriesMapRef.current.set("stUp", s);
          }
          if (downPoints.length > 0) {
            const s = chart.addLineSeries({
              color: "#ef4444",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            });
            s.setData(downPoints);
            seriesMapRef.current.set("stDown", s);
          }

          // S/D zones
          overlays.sdZones.forEach((zone) => {
            try {
              candleSeries.createPriceLine({
                price: zone.top,
                color: zone.type === "supply" ? "#ef4444" : "#10b981",
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: "",
              });
              candleSeries.createPriceLine({
                price: zone.bottom,
                color: zone.type === "supply" ? "#ef4444" : "#10b981",
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: false,
                title: "",
              });
            } catch {}
          });

          // Order blocks
          overlays.orderBlocks.forEach((ob) => {
            try {
              candleSeries.createPriceLine({
                price: ob.top,
                color: ob.type === "bullish" ? "#22c55e" : "#dc2626",
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: "",
              });
              candleSeries.createPriceLine({
                price: ob.bottom,
                color: ob.type === "bullish" ? "#22c55e" : "#dc2626",
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: "",
              });
            } catch {}
          });

          // FVG
          overlays.fvgs.forEach((fvg) => {
            try {
              candleSeries.createPriceLine({
                price: fvg.top,
                color: fvg.type === "bullish" ? "#3b82f6" : "#f97316",
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: "",
              });
              candleSeries.createPriceLine({
                price: fvg.bottom,
                color: fvg.type === "bullish" ? "#3b82f6" : "#f97316",
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: "",
              });
            } catch {}
          });

          // Round numbers
          overlays.roundNumbers.forEach((rn) => {
            try {
              candleSeries.createPriceLine({
                price: rn.level,
                color: "#9ca3af",
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: "",
              });
            } catch {}
          });

          // Pivots
          if (overlays.pivots) {
            const p = overlays.pivots;
            const list = [
              { price: p.pp, label: "PP", color: "#6366f1" },
              { price: p.r1, label: "R1", color: "#ef4444" },
              { price: p.r2, label: "R2", color: "#ef4444" },
              { price: p.r3, label: "R3", color: "#ef4444" },
              { price: p.s1, label: "S1", color: "#10b981" },
              { price: p.s2, label: "S2", color: "#10b981" },
              { price: p.s3, label: "S3", color: "#10b981" },
            ];
            list.forEach(({ price, label, color }) => {
              try {
                candleSeries.createPriceLine({
                  price,
                  color,
                  lineWidth: 1,
                  lineStyle: LineStyle.Dotted,
                  axisLabelVisible: true,
                  title: label,
                });
              } catch {}
            });
          }

          // Large range markers
          if (overlays.largeRangeCandles.length > 0) {
            candleSeries.setMarkers(
              overlays.largeRangeCandles.map((m) => ({
                time: m.time as UTCTimestamp,
                position: m.direction === "bullish" ? "belowBar" : "aboveBar",
                color: m.direction === "bullish" ? "#10b981" : "#ef4444",
                shape: m.direction === "bullish" ? "arrowUp" : "arrowDown",
                text: `${m.rangePct.toFixed(2)}%`,
              }))
            );
          }
        }

        // ===== RSI =====
        const rsiSeries = rsiChart.addLineSeries({
          color: "#8b5cf6",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        rsiSeries.setData(
          overlays.rsi.map((p) => ({
            time: p.time as UTCTimestamp,
            value: p.value,
          }))
        );
        rsiSeries.createPriceLine({
          price: 70,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "70",
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "30",
        });
        rsiSeriesRef.current = rsiSeries;

        const mainRange = chart.timeScale().getVisibleLogicalRange();
        if (mainRange) rsiChart.timeScale().setVisibleLogicalRange(mainRange);

        if (!isRefresh) {
          chart.timeScale().fitContent();
        }

        setCandleCount(candles.length);
        setLastUpdate(new Date());
        onDataLoaded?.({
          pair: selectedPair,
          timeframe,
          candleCount: candles.length,
        });
      } catch (e: any) {
        if (!cancelled && !isRefresh) {
          setError(e?.message || "Failed to load candles");
          setCandleCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render(false);

    const interval = setInterval(() => render(true), 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedPair, timeframe, showOverlays, onDataLoaded]);

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    onTimeframeChange?.(tf);
  };

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
    onPairChange?.(pair);
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "12px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          alignItems: "center",
        }}
      >
        <select
          value={selectedPair}
          onChange={(e) => handlePairChange(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            background: "#fff",
          }}
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
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
                fontWeight: timeframe === tf ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowOverlays((v) => !v)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            background: showOverlays ? "#1c69e3" : "#fff",
            color: showOverlays ? "#fff" : "#374151",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showOverlays ? "Hide Overlays" : "Show Overlays"}
        </button>

        <div
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: error ? "#ef4444" : "#10b981",
              display: "inline-block",
            }}
          />
          {loading && "Loading…"}
          {!loading && error && (
            <span style={{ color: "#ef4444" }}>Error: {error}</span>
          )}
          {!loading && !error && (
            <>
              {candleCount} candles
              {lastUpdate && (
                <span style={{ color: "#9ca3af" }}>
                  · {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ width: "100%", height: "500px", position: "relative" }}
      />

      <div
        ref={rsiContainerRef}
        style={{
          width: "100%",
          height: "120px",
          borderTop: "1px solid #e5e7eb",
          position: "relative",
        }}
      />
    </div>
  );
}