"use client";

import { useState, useMemo } from "react";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD"];

export default function CalculatorPage() {
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [pair, setPair] = useState("EUR/USD");
  const [stopLossPips, setStopLossPips] = useState(50);
  const [takeProfitPips, setTakeProfitPips] = useState(150);
  const [lotType, setLotType] = useState("standard");

  const contractSize = lotType === "standard" ? 100000 : lotType === "mini" ? 10000 : 1000;

  const results = useMemo(() => {
    const riskAmount = (accountBalance * riskPercent) / 100;
    const pipValue = pair.includes("JPY") ? 0.01 * contractSize : 0.0001 * contractSize;
    const positionSizeLots = stopLossPips > 0 ? riskAmount / (stopLossPips * pipValue) : 0;
    const potentialReward = takeProfitPips * pipValue * positionSizeLots;
    const riskRewardRatio = stopLossPips > 0 ? (takeProfitPips / stopLossPips).toFixed(2) : "0";

    return { riskAmount, pipValue, positionSizeLots, potentialReward, riskRewardRatio };
  }, [accountBalance, riskPercent, pair, stopLossPips, takeProfitPips, lotType]);

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: "600" as const,
    marginBottom: "6px",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>
          🧮 Position Size Calculator
        </h1>
        <p style={{ color: "#6b7280" }}>Calculate your optimal position size</p>
      </div>

      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "24px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}>
          <div>
            <label style={labelStyle}>Account Balance</label>
            <input
              type="number"
              value={accountBalance}
              onChange={(e) => setAccountBalance(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Risk %</label>
            <input
              type="number"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Currency Pair</label>
            <select value={pair} onChange={(e) => setPair(e.target.value)} style={inputStyle}>
              {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Stop Loss (pips)</label>
            <input
              type="number"
              value={stopLossPips}
              onChange={(e) => setStopLossPips(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Take Profit (pips)</label>
            <input
              type="number"
              value={takeProfitPips}
              onChange={(e) => setTakeProfitPips(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Lot Type</label>
            <select value={lotType} onChange={(e) => setLotType(e.target.value)} style={inputStyle}>
              <option value="standard">Standard (100,000)</option>
              <option value="mini">Mini (10,000)</option>
              <option value="micro">Micro (1,000)</option>
            </select>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #1c69e3, #783ff5)",
          borderRadius: "12px",
          padding: "24px",
          textAlign: "center",
          marginBottom: "16px",
        }}>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>Position Size</p>
          <p style={{ fontSize: "36px", fontWeight: "800", color: "#fff" }}>
            {results.positionSizeLots.toFixed(2)} lots
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
        }}>
          <div style={{ padding: "14px", background: "#fef2f2", borderRadius: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#6b7280" }}>Risk Amount</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#dc2626" }}>
              ${results.riskAmount.toFixed(2)}
            </p>
          </div>
          <div style={{ padding: "14px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#6b7280" }}>Pip Value</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
              ${results.pipValue.toFixed(4)}
            </p>
          </div>
          <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#6b7280" }}>Potential Reward</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#16a34a" }}>
              ${results.potentialReward.toFixed(2)}
            </p>
          </div>
          <div style={{ padding: "14px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "12px", color: "#6b7280" }}>Risk : Reward</p>
            <p style={{ fontSize: "20px", fontWeight: "700", color: "#111827" }}>
              1 : {results.riskRewardRatio}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}