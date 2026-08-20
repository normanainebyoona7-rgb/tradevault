"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountInputsProps {
  accountBalance: number;
  accountCurrency: string;
  riskPercent: number;
  onBalanceChange: (value: number) => void;
  onCurrencyChange: (value: string) => void;
  onRiskChange: (value: number) => void;
}

const currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"];

const riskOptions = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 5, 10];

export function AccountInputs({
  accountBalance,
  accountCurrency,
  riskPercent,
  onBalanceChange,
  onCurrencyChange,
  onRiskChange,
}: AccountInputsProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
        Account Settings
      </h3>

      <div className="space-y-2">
        <Label htmlFor="balance">Account Balance</Label>
        <Input
          id="balance"
          type="number"
          value={accountBalance}
          onChange={(e) => onBalanceChange(Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Account Currency</Label>
        <Select value={accountCurrency} onValueChange={onCurrencyChange}>
          <SelectTrigger id="currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Risk Per Trade: {riskPercent}%</Label>
        <div className="flex flex-wrap gap-2">
          {riskOptions.map((risk) => (
            <button
              key={risk}
              type="button"
              onClick={() => onRiskChange(risk)}
              className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                riskPercent === risk
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-input"
              }`}
            >
              {risk}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
