"use client";

import { useState, useEffect, useCallback } from "react";
import { TradeCard } from "./trade-card";
import type { Trade } from "@/types";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function TradeList() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    wins: 0,
    losses: 0,
    totalPnl: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchTrades = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/trades?page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTrades(data.trades);
      setHasMore(data.hasMore);
    } catch (err) {
      setError("Failed to load trades");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const data = await res.json();
        setStats({
          total: data.totalTrades,
          wins: data.wins,
          losses: data.losses,
          totalPnl: data.totalPnl,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchTrades();
    fetchStats();
  }, [fetchTrades, fetchStats]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTrades((prev) => prev.filter((t) => t._id !== id));
        fetchStats();
      }
    } catch {
      setError("Failed to delete trade");
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Trades</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Wins</p>
            <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Losses</p>
            <p className="text-2xl font-bold text-red-500">{stats.losses}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p
              className={`text-2xl font-bold ${stats.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              ${stats.totalPnl.toFixed(2)}
            </p>
          </Card>
        </div>
      )}

      {error && <div className="text-center py-12 text-red-500">{error}</div>}

      {trades.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          No trades found. Start logging your trades!
        </div>
      )}

      <div className="space-y-3">
        {trades.map((trade) => (
          <TradeCard key={trade._id} trade={trade} onDelete={handleDelete} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Load More Trades
          </button>
        </div>
      )}
    </div>
  );
}
