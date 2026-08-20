export interface StatsCards {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  avgRMultiple: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface EquityCurvePoint {
  date: Date;
  pnl: number;
  balance: number;
}

export interface SessionStats {
  session: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
}

export interface StrategyStats {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
  avgRMultiple: number;
}

export interface PairStats {
  pair: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface MonthlyStats {
  month: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
}

export interface AnalyticsResponse {
  stats: StatsCards;
  equityCurve: EquityCurvePoint[];
  sessionStats: SessionStats[];
  strategyStats: StrategyStats[];
  pairStats: PairStats[];
  monthlyStats: MonthlyStats[];
  periodStart: Date;
  periodEnd: Date;
}
