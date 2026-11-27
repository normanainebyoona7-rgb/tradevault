"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  Activity,
  Camera,
  Download,
  Layers,
  Loader2,
  ScanSearch,
  TrendingDown,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react";
import { PAIR_GROUPS, formatPrice } from "@/lib/pairs";
import { computeOverlays, type Overlays } from "@/lib/overlays";
import type { Candle } from "@/lib/data/candles";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D"];

const TF_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
};

const TICK_INTERVAL_MS = 4000;

interface LayerFlags {
  sd: boolean;
  ob: boolean;
  fvg: boolean;
  liq: boolean;
  ma: boolean;
  levels: boolean;
}

const DEFAULT_LAYERS: LayerFlags = {
  sd: true,
  ob: true,
  fvg: true,
  liq: true,
  ma: true,
  levels: true,
};

const LAYER_LABELS: { key: keyof LayerFlags; label: string }[] = [
  { key: "sd", label: "S&D" },
  { key: "ob", label: "OB" },
  { key: "fvg", label: "FVG" },
  { key: "liq", label: "Liquidity" },
  { key: "ma", label: "MAs" },
  { key: "levels", label: "Levels" },
];

function isDark(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

function palette() {
  const dark = isDark();
  return {
    dark,
    bg: dark ? "#0b1512" : "#ffffff",
    text: dark ? "#a7c2b6" : "#475569",
    grid: dark ? "#143028" : "#eef2f1",
    border: dark ? "#143028" : "#e5e7eb",
    boxText: dark ? "#e2f5ec" : "#0f172a",
  };
}

interface AnalysisResult {
  status?: string;
  message?: string;
  analysis?: string;
  signal?: any;
  smc?: any;
  pair: string;
  timeframe: string;
  shot: string | null;
}

export function LiveChart({
  onPairChange,
  onTimeframeChange,
  initialPair,
  initialTimeframe,
  onDataLoaded,
  online = true,
  onSaveSnapshot,
}: {
  onPairChange?: (pair: string) => void;
  onTimeframeChange?: (tf: string) => void;
  initialPair?: string;
  initialTimeframe?: string;
  onDataLoaded?: (info: {
    pair: string;
    timeframe: string;
    candleCount: number;
  }) => void;
  online?: boolean;
  onSaveSnapshot?: (dataUrl: string, filename: string) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const analysisSequenceRef = useRef(0);
  const lastOverlayAtRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const priceLinesRef = useRef<{ series: ISeriesApi<any>; line: IPriceLine }[]>([]);

  const candlesRef = useRef<Candle[]>([]);
  const overlaysRef = useRef<Overlays | null>(null);
  const showOverlaysRef = useRef(true);
  const layersRef = useRef<LayerFlags>(DEFAULT_LAYERS);

  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;
  const onPairChangeRef = useRef(onPairChange);
  onPairChangeRef.current = onPairChange;
  const onTimeframeChangeRef = useRef(onTimeframeChange);
  onTimeframeChangeRef.current = onTimeframeChange;

  const [selectedPair, setSelectedPair] = useState(initialPair || "EUR/USD");
  const [timeframe, setTimeframe] = useState(initialTimeframe || "1H");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candleCount, setCandleCount] = useState(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [layers, setLayers] = useState<LayerFlags>(DEFAULT_LAYERS);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [prevClose, setPrevClose] = useState<number | null>(null);
  const [tickSource, setTickSource] = useState<string>("connecting");
  const [tickStatus, setTickStatus] = useState<"connecting" | "live" | "stale" | "offline">("connecting");
  const [lastTickAt, setLastTickAt] = useState<Date | null>(null);
  const [networkOnline, setNetworkOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const feedFresh =
    online &&
    networkOnline &&
    tickStatus === "live" &&
    lastTickAt != null &&
    Date.now() - lastTickAt.getTime() < 20_000;

  showOverlaysRef.current = showOverlays;
  layersRef.current = layers;

  // ===== BOX LAYER =====

  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => {
      setNetworkOnline(false);
      setTickStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const drawBoxes = useCallback(() => {
    const host = overlayRef.current;
    if (!host) return;
    host.innerHTML = "";

    if (!showOverlaysRef.current) return;

    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const candles = candlesRef.current;
    const ov = overlaysRef.current;
    if (!chart || !series || !ov || candles.length === 0) return;

    const flags = layersRef.current;
    const timeScale = chart.timeScale();
    const right = timeScale.width();
    const theme = palette();

    const addBox = (
      index: number,
      top: number,
      bottom: number,
      opts: { fill: string; border: string; label: string; labelColor: string; dashed?: boolean; endTime?: number }
    ) => {
      const candle = candles[Math.min(Math.max(index, 0), candles.length - 1)];
      if (!candle) return;

      const x = timeScale.timeToCoordinate(candle.time as UTCTimestamp);
      if (x === null) return;

      const yTop = series.priceToCoordinate(top);
      const yBottom = series.priceToCoordinate(bottom);
      if (yTop === null || yBottom === null) return;

      const left = Math.max(0, x);
      const endX = opts.endTime == null
        ? right
        : timeScale.timeToCoordinate(opts.endTime as UTCTimestamp);
      const width = (endX ?? right) - left;
      if (width <= 2) return;

      const height = Math.max(2, Math.abs(yBottom - yTop));

      const box = document.createElement("div");
      box.style.position = "absolute";
      box.style.left = `${left}px`;
      box.style.width = `${width}px`;
      box.style.top = `${Math.min(yTop, yBottom)}px`;
      box.style.height = `${height}px`;
      box.style.background = opts.fill;
      box.style.border = `1px ${opts.dashed ? "dashed" : "solid"} ${opts.border}`;
      box.style.borderRadius = "2px";
      box.style.pointerEvents = "none";
      box.style.overflow = "hidden";
      host.appendChild(box);

      if (height >= 14) {
        const label = document.createElement("span");
        label.textContent = opts.label;
        label.style.position = "absolute";
        label.style.left = "5px";
        label.style.top = "1px";
        label.style.fontSize = "9px";
        label.style.fontWeight = "700";
        label.style.letterSpacing = "0.06em";
        label.style.color = opts.labelColor;
        label.style.textShadow = theme.dark ? "0 1px 2px #000" : "0 1px 2px #fff";
        label.style.whiteSpace = "nowrap";
        box.appendChild(label);
      }
    };

    const demand = { fill: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.75)", labelColor: "#059669" };
    const supply = { fill: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.75)", labelColor: "#e11d48" };

    if (flags.sd) {
      for (const zone of ov.sdZones) {
        const style = zone.type === "demand" ? demand : supply;
        addBox(zone.index, zone.top, zone.bottom, {
          ...style,
          label: zone.type === "demand" ? "DEMAND" : "SUPPLY",
        });
      }
    }

    if (flags.ob) {
      for (const ob of ov.orderBlocks) {
        const style =
          ob.type === "bullish"
            ? { fill: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.6)", labelColor: "#2563eb" }
            : { fill: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.6)", labelColor: "#ea580c" };
        addBox(ob.index, ob.top, ob.bottom, {
          ...style,
          label: ob.type === "bullish" ? "OB +" : "OB −",
        });
      }
    }

    if (flags.fvg) {
      for (const fvg of ov.fvgs) {
        const style =
          fvg.type === "bullish"
            ? { fill: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.55)", labelColor: "#7c3aed" }
            : { fill: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.55)", labelColor: "#db2777" };
        addBox(fvg.index, fvg.top, fvg.bottom, {
          ...style,
          label: fvg.type === "bullish" ? "FVG +" : "FVG −",
          dashed: true,
        });
      }
    }

    if (flags.levels) {
      const bucket = TF_SECONDS[timeframe] ?? 3600;
      for (const session of ov.sessions.slice(-6)) {
        const index = candles.findIndex((candle) => candle.time >= session.startTime);
        if (index < 0) continue;
        addBox(index, session.high, session.low, {
          fill: "rgba(100,116,139,0.05)",
          border: "rgba(100,116,139,0.35)",
          label: session.name.toUpperCase(),
          labelColor: theme.text,
          endTime: session.endTime + bucket,
        });
      }
    }
  }, [timeframe]);

  const clearPriceLines = useCallback(() => {
    for (const entry of priceLinesRef.current) {
      try {
        entry.series.removePriceLine(entry.line);
      } catch {}
    }
    priceLinesRef.current = [];
  }, []);

  // ===== INDICATORS / LEVELS / MARKERS =====

  const renderOverlays = useCallback(
    (candles: Candle[], ov: Overlays) => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!chart || !candleSeries) return;

      for (const series of indicatorSeriesRef.current.values()) {
        try {
          chart.removeSeries(series);
        } catch {}
      }
      indicatorSeriesRef.current.clear();
      clearPriceLines();
      candleSeries.setMarkers([]);

      if (!showOverlaysRef.current) {
        drawBoxes();
        return;
      }

      const flags = layersRef.current;

      const addLine = (
        key: string,
        data: { time: number; value: number }[],
        color: string,
        width: 1 | 2 | 3 = 1,
        style: LineStyle = LineStyle.Solid
      ) => {
        if (data.length === 0) return;
        const series = chart.addLineSeries({
          color,
          lineWidth: width,
          lineStyle: style,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        series.setData(
          data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
        indicatorSeriesRef.current.set(key, series);
      };

      if (flags.ma) {
        addLine("sma9", ov.sma9, "#f59e0b", 1);
        addLine("sma21", ov.sma21, "#3b82f6", 1);
        addLine("ema50", ov.ema50, "#10b981", 2);
        addLine("sma200", ov.sma200, "#6366f1", 2);
        addLine("vwap", ov.vwap, "#06b6d4", 1, LineStyle.Dashed);
        addLine("supertrend", ov.supertrend, "#ec4899", 1, LineStyle.Dotted);
      }

      const addPriceLine = (
        price: number,
        color: string,
        title: string,
        style: LineStyle = LineStyle.Dashed
      ) => {
        try {
          const line = candleSeries.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: style,
            axisLabelVisible: true,
            title,
          });
          priceLinesRef.current.push({ series: candleSeries, line });
        } catch {}
      };

      if (flags.liq) {
        const price = candles[candles.length - 1]?.close ?? 0;
        const above = ov.liquidityZones
          .filter((z) => z.price > price)
          .sort((a, b) => a.price - b.price)
          .slice(0, 2);
        const below = ov.liquidityZones
          .filter((z) => z.price <= price)
          .sort((a, b) => b.price - a.price)
          .slice(0, 2);
        for (const liq of [...above, ...below]) {
          addPriceLine(
            liq.price,
            liq.type === "buy_side" ? "#f59e0b" : "#f43f5e",
            liq.type === "buy_side" ? "BSL" : "SSL",
            LineStyle.Dotted
          );
        }
      }

      if (flags.levels) {
        const price = candles[candles.length - 1]?.close ?? 0;
        const nearestRounds = [...ov.roundNumbers]
          .sort((a, b) => Math.abs(a.level - price) - Math.abs(b.level - price))
          .slice(0, 4);
        for (const level of nearestRounds) {
          addPriceLine(level.level, "#94a3b8", "RN", LineStyle.Dotted);
        }
        if (ov.pivots) {
          const p = ov.pivots;
          addPriceLine(p.pp, "#94a3b8", "PP", LineStyle.Dotted);
          addPriceLine(p.r1, "#f43f5e", "R1", LineStyle.Dotted);
          addPriceLine(p.r2, "#f43f5e", "R2", LineStyle.Dotted);
          addPriceLine(p.s1, "#10b981", "S1", LineStyle.Dotted);
          addPriceLine(p.s2, "#10b981", "S2", LineStyle.Dotted);
        }
        if (ov.premiumDiscount) {
          addPriceLine(ov.premiumDiscount.equilibrium, "#8b5cf6", "EQ", LineStyle.Dashed);
          addPriceLine(ov.premiumDiscount.oteHigh, "#0ea5e9", "OTE 62", LineStyle.Dotted);
          addPriceLine(ov.premiumDiscount.oteLow, "#0ea5e9", "OTE 79", LineStyle.Dotted);
        }
      }

      // ===== MARKERS =====
      const markers: any[] = [];
      for (const event of ov.structure.events.slice(-4)) {
        markers.push({
          time: candles[event.index]?.time ?? event.time,
          position: event.direction === "bullish" ? "belowBar" : "aboveBar",
          color: event.direction === "bullish" ? "#059669" : "#e11d48",
          shape: event.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: event.type,
        });
      }
      for (const sweep of ov.liquiditySweeps.slice(-3)) {
        markers.push({
          time: candles[sweep.index]?.time ?? sweep.time,
          position: sweep.side === "sell_side" ? "belowBar" : "aboveBar",
          color: "#f59e0b",
          shape: "circle",
          text: "Sweep",
        });
      }
      for (const lrc of ov.largeRangeCandles.slice(-4)) {
        markers.push({
          time: lrc.time,
          position: lrc.direction === "bullish" ? "belowBar" : "aboveBar",
          color: lrc.direction === "bullish" ? "#10b981" : "#ef4444",
          shape: lrc.direction === "bullish" ? "arrowUp" : "arrowDown",
          text: `${lrc.rangePct.toFixed(2)}%`,
        });
      }
      markers.sort((a, b) => Number(a.time) - Number(b.time));
      try {
        candleSeries.setMarkers(markers);
      } catch {}

      drawBoxes();
    },
    [clearPriceLines, drawBoxes]
  );

  // ===== CREATE CHARTS =====

  useEffect(() => {
    if (!containerRef.current || !rsiContainerRef.current) return;

    const theme = palette();

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme.bg },
        textColor: theme.text,
        fontFamily:
          "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      width: containerRef.current.clientWidth,
      height: 480,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: theme.border,
      },
      rightPriceScale: { borderColor: theme.border },
    });

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme.bg },
        textColor: theme.text,
        fontFamily:
          "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        visible: false,
        borderColor: theme.border,
      },
      rightPriceScale: { borderColor: theme.border },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceLineVisible: true,
      priceLineColor: "#10b981",
      priceLineStyle: LineStyle.Dotted,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: "#8b5cf6",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    rsiSeries.createPriceLine({
      price: 70,
      color: "#f43f5e",
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

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
      drawBoxes();
    });

    chartRef.current = chart;
    rsiChartRef.current = rsiChart;
    candleSeriesRef.current = candleSeries;
    rsiSeriesRef.current = rsiSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
      if (rsiContainerRef.current) {
        rsiChart.applyOptions({
          width: rsiContainerRef.current.clientWidth,
          height: rsiContainerRef.current.clientHeight,
        });
      }
      drawBoxes();
    });
    resizeObserver.observe(containerRef.current);
    resizeObserver.observe(rsiContainerRef.current);

    const themeObserver = new MutationObserver(() => {
      const next = palette();
      const options = {
        layout: {
          background: { type: ColorType.Solid, color: next.bg },
          textColor: next.text,
        },
        grid: {
          vertLines: { color: next.grid },
          horzLines: { color: next.grid },
        },
        rightPriceScale: { borderColor: next.border },
        timeScale: { borderColor: next.border },
      };
      chart.applyOptions(options as any);
      rsiChart.applyOptions(options as any);
      drawBoxes();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.remove();
      rsiChart.remove();
      chartRef.current = null;
      rsiChartRef.current = null;
      candleSeriesRef.current = null;
      rsiSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
      priceLinesRef.current = [];
    };
  }, [drawBoxes]);

  // ===== LOAD CANDLES =====

  useEffect(() => {
    let cancelled = false;

    const load = async (fit: boolean) => {
      const series = candleSeriesRef.current;
      const rsiSeries = rsiSeriesRef.current;
      if (!series || !rsiSeries) return;

      if (fit) {
        analysisControllerRef.current?.abort();
        analysisControllerRef.current = null;
        analysisSequenceRef.current += 1;
        setAnalyzing(false);
        setTickStatus("connecting");
        setLastTickAt(null);
        lastTickAtRef.current = null;
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setAnalyzeError(null);
        candlesRef.current = [];
        overlaysRef.current = null;
        series.setData([]);
        rsiSeries.setData([]);
        drawBoxes();
      }

      try {
        const res = await fetch(
          `/api/test-candles?pair=${encodeURIComponent(selectedPair)}&tf=${timeframe}&overlays=1`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;

        const candles: Candle[] = json.candles ?? [];
        if (candles.length === 0) {
          if (fit) {
            setError("No candle data returned");
            setCandleCount(0);
          }
          return;
        }

        const ov: Overlays = json.overlays ?? computeOverlays(selectedPair, candles);

        candlesRef.current = candles;
        overlaysRef.current = ov;

        series.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        rsiSeries.setData(
          ov.rsi.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );

        renderOverlays(candles, ov);

        if (fit) {
          chartRef.current?.timeScale().fitContent();
        }

        setLastPrice(candles[candles.length - 1].close);
        setPrevClose(
          candles.length > 1 ? candles[candles.length - 2].close : null
        );
        setCandleCount(candles.length);
        setLastUpdate(new Date());
        setLoading(false);

        onDataLoadedRef.current?.({
          pair: selectedPair,
          timeframe,
          candleCount: candles.length,
        });
      } catch (e: any) {
        if (!cancelled && fit) {
          setError(e?.message || "Failed to load candles");
          setCandleCount(0);
          setLoading(false);
        }
      }
    };

    load(true);
    const reload = setInterval(() => load(false), 120000);

    return () => {
      cancelled = true;
      clearInterval(reload);
    };
  }, [selectedPair, timeframe, renderOverlays, drawBoxes]);

  // ===== REAL TICKS =====

  const applyTick = useCallback(
    (price: number, source: string) => {
      const series = candleSeriesRef.current;
      const candles = candlesRef.current;
      if (!series || candles.length === 0) return;

      const last = candles[candles.length - 1];
      if (last.close > 0 && Math.abs(price - last.close) / last.close > 0.02) {
        return;
      }

      const bucket = TF_SECONDS[timeframe] ?? 3600;
      const now = Math.floor(Date.now() / 1000);
      const barTime = Math.floor(now / bucket) * bucket;

      let bar: Candle;
      if (barTime > last.time && now - last.time < bucket * 3) {
        bar = {
          time: barTime,
          open: last.close,
          high: Math.max(price, last.close),
          low: Math.min(price, last.close),
          close: price,
          volume: 0,
          is_green: price >= last.close,
        };
        candles.push(bar);
        if (candles.length > 400) candles.shift();
      } else {
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.is_green = last.close >= last.open;
        bar = last;
      }

      try {
        series.update({
          time: bar.time as UTCTimestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        });
      } catch {}

      const ov = computeOverlays(selectedPair, candles);
      overlaysRef.current = ov;
      rsiSeriesRef.current?.setData(
        ov.rsi.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
      );
      renderOverlays(candles, ov);

      setLastPrice(price);
      setPrevClose(
        candles.length > 1 ? candles[candles.length - 2].close : last.open
      );
      setTickSource(source);
      setLastUpdate(new Date());
      setCandleCount(candles.length);
    },
    [selectedPair, timeframe, renderOverlays]
  );

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(
          `/api/tick?pair=${encodeURIComponent(selectedPair)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (stopped || !json?.price) return;
        applyTick(Number(json.price), json.source ?? "—");
      } catch {}
    };

    poll();
    const interval = setInterval(poll, TICK_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [selectedPair, applyTick]);

  // ===== LAYER TOGGLES =====

  useEffect(() => {
    const ov = overlaysRef.current;
    if (!ov) return;
    renderOverlays(candlesRef.current, ov);
  }, [layers, showOverlays, renderOverlays]);

  // ===== SCREENSHOT + ANALYSIS =====

  const captureCanvas = useCallback((): HTMLCanvasElement | null => {
    const chart = chartRef.current;
    const rsiChart = rsiChartRef.current;
    if (!chart) return null;

    const main = chart.takeScreenshot();
    const rsi = rsiChart?.takeScreenshot();

    const canvas = document.createElement("canvas");
    canvas.width = main.width;
    canvas.height = main.height + (rsi?.height ?? 0);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = palette().bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(main, 0, 0);

    const overlayHost = overlayRef.current;
    if (overlayHost) {
      const hostRect = overlayHost.getBoundingClientRect();
      if (hostRect.width > 0 && hostRect.height > 0) {
        const scaleX = main.width / hostRect.width;
        const scaleY = main.height / hostRect.height;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, main.width, main.height);
        ctx.clip();

        for (const box of Array.from(overlayHost.children)) {
          const rect = box.getBoundingClientRect();
          const style = getComputedStyle(box);
          const x = (rect.left - hostRect.left) * scaleX;
          const y = (rect.top - hostRect.top) * scaleY;
          const width = rect.width * scaleX;
          const height = rect.height * scaleY;

          ctx.fillStyle = style.backgroundColor;
          ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = style.borderTopColor;
          ctx.lineWidth = Math.max(1, Number.parseFloat(style.borderTopWidth) * scaleX);
          ctx.setLineDash(style.borderTopStyle === "dashed" ? [4 * scaleX, 4 * scaleX] : []);
          ctx.strokeRect(x, y, width, height);
          ctx.setLineDash([]);

          const label = box.querySelector("span");
          if (label) {
            const labelStyle = getComputedStyle(label);
            const fontSize = Number.parseFloat(labelStyle.fontSize) || 9;
            ctx.font = `700 ${fontSize * scaleX}px sans-serif`;
            ctx.fillStyle = labelStyle.color;
            ctx.fillText(
              label.textContent || "",
              x + 5 * scaleX,
              y + (fontSize + 1) * scaleY
            );
          }
        }
        ctx.restore();
      }
    }

    if (rsi) ctx.drawImage(rsi, 0, main.height);

    return canvas;
  }, []);

  const handleAnalyze = async () => {
    if (loading || error || candleCount === 0 || analyzing) return;

    setAnalyzing(true);
    setAnalyzeError(null);

    const shot = captureCanvas()?.toDataURL("image/png") ?? null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          pair: selectedPair,
          timeframe,
          candles: candlesRef.current.slice(-400),
        }),
      });
      const text = await res.text();
      const data = text
        ? (() => {
            try {
              return JSON.parse(text);
            } catch {
              return null;
            }
          })()
        : null;

      if (!res.ok) {
        setAnalyzeError(
          data?.message || data?.error || `Analysis failed (HTTP ${res.status}).`
        );
        return;
      }
      if (!data || !["signal", "neutral"].includes(data.status)) {
        setAnalyzeError("The analysis service returned an invalid response.");
        return;
      }

      setAnalysis({
        status: data.status,
        message: data.message,
        analysis: data.analysis,
        signal: data.signal,
        smc: data.smc,
        pair: selectedPair,
        timeframe,
        shot,
      });
    } catch (e: any) {
      setAnalyzeError(
        e?.name === "AbortError"
          ? "Analysis timed out. Please try again."
          : "Could not reach the analysis service."
      );
    } finally {
      clearTimeout(timeout);
      setAnalyzing(false);
    }
  };

  const handleScreenshot = () => {
    const canvas = captureCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${selectedPair.replace("/", "")}-${timeframe}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const change =
    lastPrice != null && prevClose != null ? lastPrice - prevClose : null;
  const changePct =
    change != null && prevClose ? (change / prevClose) * 100 : null;

  const toggleLayer = (key: keyof LayerFlags) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const s = analysis?.signal;
  const isLong = s?.direction === "long";
  const isShort = s?.direction === "short";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-3 py-3">
        <select
          value={selectedPair}
          onChange={(e) => {
            setSelectedPair(e.target.value);
            onPairChangeRef.current?.(e.target.value);
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
        >
          {PAIR_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.pairs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeframe(tf);
                onTimeframeChangeRef.current?.(tf);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowOverlays((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            showOverlays
              ? "border-primary/30 bg-accent text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Overlays
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                error ? "bg-destructive" : "animate-pulse bg-emerald-500"
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {error ? "Offline" : `Live · ${tickSource}`}
            </span>
          </div>
          <div className="text-right">
            <div
              className={`text-sm font-bold tabular-nums ${
                change == null
                  ? "text-foreground"
                  : change >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {lastPrice != null ? formatPrice(selectedPair, lastPrice) : "—"}
            </div>
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {change != null &&
                (change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                ))}
              {changePct != null && (
                <span className="tabular-nums">
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(3)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LAYER CHIPS */}
      {showOverlays && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
          {LAYER_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                layers[key]
                  ? "border-primary/30 bg-accent text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {loading
              ? "Loading candles…"
              : `${candleCount} candles · ${
                  lastUpdate ? lastUpdate.toLocaleTimeString() : "—"
                }`}
          </span>
        </div>
      )}

      {/* CHART */}
      <div className="relative">
        <div ref={containerRef} className="relative h-[380px] w-full md:h-[480px]" />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        />
        {loading && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-card/60 text-sm font-medium text-muted-foreground backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading candles…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/80 text-sm font-medium text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="relative h-[110px] border-t border-border md:h-[120px]">
        <div ref={rsiContainerRef} className="relative h-full w-full" />
        <span className="pointer-events-none absolute left-2 top-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          RSI 14
        </span>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface/60 px-3 py-3">
        <button
          onClick={handleAnalyze}
          disabled={analyzing || loading || !!error || candleCount === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="h-4 w-4" />
          )}
          {analyzing ? "Analyzing chart…" : "Analyze chart (SMC · ICT · S&D)"}
        </button>
        <button
          onClick={handleScreenshot}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
        >
          <Camera className="h-4 w-4" />
          Screenshot
        </button>
        {lastUpdate && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ANALYSIS RESULT */}
      {analyzeError && (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {analyzeError}
        </div>
      )}

      {analysis && (
        <div className="border-t border-border bg-background px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {analysis.pair} · {analysis.timeframe}
              </h3>
              <p className="text-xs text-muted-foreground">
                {s?.orderTypeDescription || analysis.message || "No setup"}
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isLong
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : isShort
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s?.signalLabel || "NEUTRAL"}
            </div>
            <button
              onClick={() => setAnalysis(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close analysis"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {analysis.status === "signal" && s && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Entry", value: s.entryPrice, tone: "text-foreground" },
                { label: "Stop loss", value: s.stopLossPrice, tone: "text-rose-600 dark:text-rose-400" },
                { label: "TP1", value: s.takeProfit1Price, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "TP2", value: s.takeProfit2Price, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "TP3", value: s.takeProfit3Price, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "Risk", value: s.riskPips, tone: "text-foreground", suffix: " pips" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${item.tone}`}>
                    {item.suffix
                      ? `${item.value ?? 0}${item.suffix}`
                      : formatPrice(analysis.pair, item.value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis.status === "neutral" && s && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  label: "Current price",
                  value: formatPrice(analysis.pair, s.currentPrice),
                },
                {
                  label: "SMC bias",
                  value: analysis.smc?.direction?.toUpperCase() || "NEUTRAL",
                },
                {
                  label: "SMC score",
                  value: `${analysis.smc?.score ?? 0}/100`,
                },
                {
                  label: "Price check",
                  value: s.priceVerification?.verified ? "Verified" : "Unverified",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="text-sm font-bold tabular-nums text-foreground">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis.smc && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.smc.structure && (
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  {analysis.smc.structure.lastEvent
                    ? `${analysis.smc.structure.lastEvent.type} ${analysis.smc.structure.lastEvent.direction}`
                    : `Structure ${analysis.smc.structure.trend}`}
                </span>
              )}
              {analysis.smc.premiumDiscount && (
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  {analysis.smc.premiumDiscount.zone} ·{" "}
                  {(analysis.smc.premiumDiscount.position * 100).toFixed(0)}%
                </span>
              )}
              {analysis.smc.killzone?.active && (
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  {analysis.smc.killzone.name} killzone
                </span>
              )}
              {analysis.smc.confidence && (
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-primary">
                  SMC {analysis.smc.score}/100 · {analysis.smc.confidence}
                </span>
              )}
            </div>
          )}

          {analysis.smc?.confluences?.length > 0 && (
            <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {analysis.smc.confluences.slice(0, 8).map((line: string, i: number) => (
                <li key={i} className="truncate" title={line}>
                  {line}
                </li>
              ))}
            </ul>
          )}

          {analysis.analysis && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-primary">
                Full breakdown
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground">
                {analysis.analysis}
              </pre>
            </details>
          )}

          {analysis.shot && (
            <div className="mt-3 flex items-start gap-3">
              <img
                src={analysis.shot}
                alt="Captured chart snapshot"
                className="max-h-32 rounded-lg border border-border"
              />
              <a
                href={analysis.shot}
                download={`${analysis.pair.replace("/", "")}-${analysis.timeframe}-analysis.png`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Download snapshot
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
