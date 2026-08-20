import { formatNumber, formatCurrency } from "@/lib/utils";
import type { CalculatorResult } from "@/lib/calculator";

interface ResultDisplayProps {
  result: CalculatorResult;
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  return (
    <div className="rounded-lg border-2 border-primary bg-primary/5 p-6 text-center">
      <p className="text-sm text-muted-foreground mb-2">POSITION SIZE</p>
      <p className="text-5xl font-bold text-primary">
        {formatNumber(result.positionSizeLots, 2)}
      </p>
      <p className="text-lg text-muted-foreground mt-1">lots</p>

      <div className="grid grid-cols-2 gap-4 mt-6 text-left">
        <div>
          <p className="text-xs text-muted-foreground">Risk Amount</p>
          <p className="text-lg font-semibold text-red-500">
            {formatCurrency(result.riskAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pip Value</p>
          <p className="text-lg font-semibold">
            {formatCurrency(result.pipValue)}
          </p>
        </div>
        {result.potentialReward > 0 && (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Potential Reward</p>
              <p className="text-lg font-semibold text-green-500">
                {formatCurrency(result.potentialReward)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risk:Reward</p>
              <p className="text-lg font-semibold">
                1:{formatNumber(result.riskRewardRatio, 1)}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
