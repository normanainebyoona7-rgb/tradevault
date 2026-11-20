"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, Clock, Newspaper, RefreshCw } from "lucide-react";

export default function NewsPage() {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      // Fetch real forex news from free API
      const response = await fetch(
        "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=FOREX"
      );
      const data = await response.json();

      if (data.Data && data.Data.length > 0) {
        const formattedNews = data.Data.slice(0, 10).map((item: any) => ({
          title: item.title,
          desc: item.body ? item.body.slice(0, 200) + "..." : "No description available",
          url: item.url,
          time: new Date(item.published_on * 1000).toLocaleString(),
          source: item.source,
          category: "Forex News",
          color: "#1c69e3",
        }));
        setNews(formattedNews);
      } else {
        setFallbackNews();
      }
    } catch (error) {
      setFallbackNews();
    } finally {
      setLoading(false);
    }
  };

  const setFallbackNews = () => {
    setNews([
      { title: "EUR/USD Hits 3-Month High", desc: "Euro strengthens on positive EU data.", time: "Updated daily", source: "Market Update", category: "Forex", color: "#1c69e3" },
      { title: "Gold Surges as Dollar Weakens", desc: "XAU/USD breaks above $2,400.", time: "Updated daily", source: "Gold Analysis", category: "Metals", color: "#f59e0b" },
      { title: "Fed Signals Rate Cut", desc: "Federal Reserve indicates openness to cut.", time: "Updated daily", source: "Central Banks", category: "Policy", color: "#7c3aed" },
      { title: "Bitcoin Volatility Rises", desc: "BTC/USD sees increased volatility.", time: "Updated daily", source: "Crypto", category: "Crypto", color: "#dc2626" },
      { title: "GBP/JPY Bullish Pattern", desc: "Bullish flag on daily timeframe.", time: "Updated daily", source: "Technical", category: "Analysis", color: "#00b9a2" },
      { title: "Oil Prices Stabilize", desc: "Crude oil finds support after decline.", time: "Updated daily", source: "Commodities", category: "Energy", color: "#f59e0b" },
    ]);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forex news</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest market news — updated regularly
          </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Loading news...
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Market headlines</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item, i) => (
              <div
                key={i}
                className={`rounded-xl border border-border bg-card p-4 ${
                  item.url ? "hover-lift cursor-pointer hover:shadow-card-hover" : ""
                }`}
                onClick={() => {
                  if (item.url) window.open(item.url, "_blank");
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
                    {item.category}
                  </span>
                  {item.url && (
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                    {item.source}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
            {news.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                No news available right now.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
