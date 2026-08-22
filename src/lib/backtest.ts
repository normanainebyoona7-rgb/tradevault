// src/lib/backtest.ts

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  averageRR: number;
}

export function backtestStrategy(
  prices: number[],
  direction: "long" | "short",
  stopLossPips: number,
  takeProfitPips: number,
  pipSize: number,
): BacktestResult {
  const trades = [];
  let inTrade = false;
  let entryPrice = 0;
  let stopLoss = 0;
  let takeProfit = 0;
  let tradeDirection: "long" | "short" = direction;

  for (let i = 1; i < prices.length; i++) {
    if (!inTrade) {
      // Enter trade
      entryPrice = prices[i];
      if (tradeDirection === "long") {
        stopLoss = entryPrice - stopLossPips * pipSize;
        takeProfit = entryPrice + takeProfitPips * pipSize;
      } else {
        stopLoss = entryPrice + stopLossPips * pipSize;
        takeProfit = entryPrice - takeProfitPips * pipSize;
      }
      inTrade = true;
    } else {
      // Check SL/TP
      if (tradeDirection === "long") {
        if (prices[i] <= stopLoss) {
          trades.push({ pnl: -stopLossPips * pipSize, result: "loss" });
          inTrade = false;
        } else if (prices[i] >= takeProfit) {
          trades.push({ pnl: takeProfitPips * pipSize, result: "win" });
          inTrade = false;
        }
      } else {
        if (prices[i] >= stopLoss) {
          trades.push({ pnl: -stopLossPips * pipSize, result: "loss" });
          inTrade = false;
        } else if (prices[i] <= takeProfit) {
          trades.push({ pnl: takeProfitPips * pipSize, result: "win" });
          inTrade = false;
        }
      }
    }
  }

  // Calculate statistics
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === "win").length;
  const losses = trades.filter(t => t.result === "loss").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winTrades = trades.filter(t => t.result === "win");
  const lossTrades = trades.filter(t => t.result === "loss");
  const averageWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length : 0;
  const averageLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length : 0;
  const profitFactor = averageLoss !== 0 ? Math.abs(averageWin / averageLoss) : 0;

  // Max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;
  for (const trade of trades) {
    runningPnl += trade.pnl;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    totalTrades,
    wins,
    losses,
    winRate: Number(winRate.toFixed(1)),
    totalPnl: Number(totalPnl.toFixed(2)),
    averageWin: Number(averageWin.toFixed(2)),
    averageLoss: Number(averageLoss.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    bestTrade: Number(Math.max(...trades.map(t => t.pnl), 0).toFixed(2)),
    worstTrade: Number(Math.min(...trades.map(t => t.pnl), 0).toFixed(2)),
    averageRR: Number((takeProfitPips / stopLossPips).toFixed(2)),
  };
}