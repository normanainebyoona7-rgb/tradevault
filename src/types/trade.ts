export type TradeDirection = "long" | "short";

export type TradeStatus = "win" | "loss" | "breakeven" | "open";

export type TradingSession = "london" | "new_york" | "asian" | "other";

export interface TradeScreenshot {
  url: string;
  label: string;
  uploadedAt: Date;
}

export interface Trade {
  _id: string;
  userId: string;
  tradeNumber: number;

  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;

  exitPrice: number | null;
  exitDate: Date | null;

  riskAmount: number;
  rewardAmount: number;
  pnl: number | null;
  rMultiple: number | null;
  status: TradeStatus;

  session: TradingSession;
  strategy: string;
  tags: string[];
  notes: string;
  mistakes: string[];

  screenshots: TradeScreenshot[];

  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTradeInput {
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  exitPrice?: number | null;
  exitDate?: Date | null;
  session: TradingSession;
  strategy: string;
  tags?: string[];
  notes?: string;
  mistakes?: string[];
  screenshots?: { url: string; label: string }[];
  entryDate: Date;
}

export interface UpdateTradeInput extends Partial<CreateTradeInput> {
  _id: string;
}

export interface TradeFilters {
  status?: TradeStatus | "all";
  pair?: string;
  session?: TradingSession | "all";
  strategy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedTrades {
  trades: Trade[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
