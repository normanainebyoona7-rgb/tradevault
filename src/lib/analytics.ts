import type { Trade } from "@/types";

export function calculateStats(trades: Trade[]) {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.status === "win");
  const losses = trades.filter((t) => t.status === "loss");
  const breakeven = trades.filter((t) => t.status === "breakeven");

  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const winsPnl = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const lossesPnl = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0));

  const avgWin = wins.length > 0 ? winsPnl / wins.length : 0;
  const avgLoss = losses.length > 0 ? lossesPnl / losses.length : 0;
  const profitFactor =
    lossesPnl > 0 ? winsPnl / lossesPnl : winsPnl > 0 ? Infinity : 0;

  const avgRMultiple =
    totalTrades > 0
      ? trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / totalTrades
      : 0;

  const largestWin =
    wins.length > 0 ? Math.max(...wins.map((t) => t.pnl || 0)) : 0;
  const largestLoss =
    losses.length > 0 ? Math.min(...losses.map((t) => t.pnl || 0)) : 0;

  // Equity curve
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
  );
  let runningTotal = 0;
  const equityCurve = sortedTrades.map((t) => {
    runningTotal += t.pnl || 0;
    return {
      date: t.entryDate,
      pnl: t.pnl || 0,
      balance: runningTotal,
    };
  });

  // Streaks
  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempStreak = 0;

  for (const t of [...trades].reverse()) {
    if (t.status === "win") {
      tempStreak = tempStreak > 0 ? tempStreak + 1 : 1;
    } else if (t.status === "loss") {
      tempStreak = tempStreak < 0 ? tempStreak - 1 : -1;
    }
  }
  currentStreak = tempStreak;

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnl: Math.round(totalPnl * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    largestWin: Math.round(largestWin * 100) / 100,
    largestLoss: Math.round(largestLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgRMultiple: Math.round(avgRMultiple * 100) / 100,
    currentStreak,
    longestWinStreak,
    longestLossStreak,
    equityCurve,
  };
}
