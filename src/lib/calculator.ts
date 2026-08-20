import { getPipValue } from "./forex-data";
import { roundTo } from "./utils";

export interface CalculatorInput {
  accountBalance: number;
  accountCurrency: string;
  riskPercent: number;
  pair: string;
  stopLossPips: number;
  takeProfitPips?: number;
  contractSize: number;
}

export interface CalculatorResult {
  positionSizeLots: number;
  riskAmount: number;
  pipValue: number;
  potentialReward: number;
  riskRewardRatio: number;
  totalRisk: number;
}

export function calculatePositionSize(
  input: CalculatorInput,
): CalculatorResult {
  const {
    accountBalance,
    riskPercent,
    stopLossPips,
    pair,
    accountCurrency,
    contractSize,
    takeProfitPips,
  } = input;

  // Calculate dollar risk amount
  const riskAmount = accountBalance * (riskPercent / 100);

  // Get pip value for this pair
  const pipValue = getPipValue(pair, accountCurrency, contractSize);

  // Calculate position size in lots
  // Position Size = Risk Amount / (Stop Loss in Pips × Pip Value)
  const positionSizeLots = riskAmount / (stopLossPips * pipValue);

  // Calculate potential reward
  const potentialReward = takeProfitPips
    ? takeProfitPips * pipValue * positionSizeLots
    : 0;

  // Calculate risk:reward ratio
  const riskRewardRatio = takeProfitPips ? takeProfitPips / stopLossPips : 0;

  // Calculate total risk
  const totalRisk = stopLossPips * pipValue * positionSizeLots;

  return {
    positionSizeLots: roundTo(positionSizeLots, 2),
    riskAmount: roundTo(riskAmount, 2),
    pipValue: roundTo(pipValue, 4),
    potentialReward: roundTo(potentialReward, 2),
    riskRewardRatio: roundTo(riskRewardRatio, 2),
    totalRisk: roundTo(totalRisk, 2),
  };
}
