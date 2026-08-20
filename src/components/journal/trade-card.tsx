"use client";

import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { Trade } from "@/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TradeCardProps {
  trade: Trade;
  onDelete: (id: string) => void;
}

export function TradeCard({ trade, onDelete }: TradeCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const isWin = trade.status === "win";
  const isLoss = trade.status === "loss";

  const statusColor = isWin
    ? "border-l-green-500"
    : isLoss
      ? "border-l-red-500"
      : "border-l-gray-400";

  return (
    <Card className={cn("border-l-4", statusColor)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {trade.direction === "long" ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
              <span className="font-semibold">{trade.pair}</span>
              <Badge
                variant={
                  trade.status === "win"
                    ? "default"
                    : trade.status === "loss"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs"
              >
                {trade.status.toUpperCase()}
              </Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              <span>{formatDate(trade.entryDate)}</span>
              <span className="mx-2">•</span>
              <span>{trade.session?.replace("_", " ")}</span>
              {trade.strategy && (
                <>
                  <span className="mx-2">•</span>
                  <span>{trade.strategy}</span>
                </>
              )}
            </div>

            {trade.tags && trade.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {trade.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {trade.notes && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {trade.notes}
              </p>
            )}
          </div>

          <div className="text-right space-y-1">
            {trade.pnl !== null ? (
              <p
                className={cn(
                  "text-lg font-bold",
                  trade.pnl > 0
                    ? "text-green-500"
                    : trade.pnl < 0
                      ? "text-red-500"
                      : "",
                )}
              >
                {formatCurrency(trade.pnl)}
              </p>
            ) : (
              <p className="text-lg font-bold text-muted-foreground">Open</p>
            )}
            {trade.rMultiple !== null && (
              <p className="text-sm text-muted-foreground">
                {trade.rMultiple > 0 ? "+" : ""}
                {trade.rMultiple.toFixed(2)}R
              </p>
            )}
            <div className="flex gap-1 mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push(`/journal/${trade._id}`)}
              >
                ✏️
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  await onDelete(trade._id);
                  setIsDeleting(false);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
