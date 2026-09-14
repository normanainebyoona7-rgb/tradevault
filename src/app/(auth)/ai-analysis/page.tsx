"use client";

import { useState, useEffect } from "react";
import { TradingViewChart } from "@/components/charts/tradingview-chart";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

export default function AIAnalysisPage() {
  const [currentPair, setCurrentPair] = useState("XAU/USD");
  const [currentTimeframe, setCurrentTimeframe] = useState("1H");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signal, setSignal] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [userTier, setUserTier] = useState("free");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUserTier(data.user.tier || "free");
      })
      .catch(() => {});

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const canSeeAllTPs = userTier === "vip" || userTier === "vvip";

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setSignal(null);

    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: currentPair,
          timeframe: currentTimeframe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || "Analysis failed");
        return;
      }

      setSignal(data.signal);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: "14px",
    fontWeight: "600" as const,
    marginBottom: "6px",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: isMobile ? "12px" : "24px" }}>
      <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "800", marginBottom: "8px" }}>
        🎯 Signal Analysis
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
        Select a pair and timeframe to get an SMC signal.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <TradingViewChart
          onPairChange={setCurrentPair}
          onTimeframeChange={setCurrentTimeframe}
        />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
        gap: "12px",
        marginBottom: "20px",
      }}>
        <div>
          <label style={labelStyle}>Pair</label>
          <select value={currentPair} onChange={(e) => setCurrentPair(e.target.value)} style={inputStyle}>
            {["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "XAG/USD", "BTC/USD", "ETH/USD", "GBP/JPY"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Timeframe</label>
          <select value={currentTimeframe} onChange={(e) => setCurrentTimeframe(e.target.value)} style={inputStyle}>
            {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: "100%",
          padding: "14px",
          background: loading ? "#9ca3af" : "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontWeight: "700",
          cursor: loading ? "wait" : "pointer",
          fontSize: "15px",
          marginBottom: "20px",
        }}
      >
        {loading ? "Analyzing..." : "🔍 Analyze"}
      </button>

      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#dc2626",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
          fontSize: "14px",
        }}>
          {error}
        </div>
      )}

      {signal && (
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: isMobile ? "16px" : "20px",
          marginBottom: "16px",
        }}>
          <div style={{
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "16px",
            textAlign: "center",
            background: signal.direction === "long" ? "#f0fdf4" : "#fef2f2",
            border: `2px solid ${signal.direction === "long" ? "#16a34a" : "#dc2626"}`,
          }}>
            <p style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
              SIGNAL
            </p>
            <p style={{
              fontSize: isMobile ? "26px" : "32px",
              fontWeight: "800",
              color: signal.direction === "long" ? "#16a34a" : "#dc2626",
              letterSpacing: "1px",
            }}>
              {signal.direction === "long" ? "📈 BUY" : "📉 SELL"}
            </p>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>
              {currentPair} • {currentTimeframe}
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: "10px",
            marginBottom: "12px",
          }}>
            <div style={{ padding: "14px", background: "#eff6ff", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>ENTRY</p>
              <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#1c69e3" }}>
                {signal.entryPrice}
              </p>
            </div>
            <div style={{ padding: "14px", background: "#fef2f2", borderRadius: "10px", textAlign: "center" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>STOP LOSS</p>
              <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#dc2626" }}>
                {signal.stopLossPrice}
              </p>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : canSeeAllTPs ? "repeat(3, 1fr)" : "1fr",
            gap: "10px",
            marginBottom: "14px",
          }}>
            <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "10px", textAlign: "center", border: "1px solid #bbf7d0" }}>
              <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>TAKE PROFIT 1</p>
              <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#16a34a" }}>
                {signal.takeProfit1Price}
              </p>
              <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                Risk:Reward 1:{signal.riskReward1}
              </p>
            </div>

            {canSeeAllTPs && (
              <>
                <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "10px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>TAKE PROFIT 2</p>
                  <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#16a34a" }}>
                    {signal.takeProfit2Price}
                  </p>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    Risk:Reward 1:{signal.riskReward2}
                  </p>
                </div>
                <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "10px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>TAKE PROFIT 3</p>
                  <p style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: "#16a34a" }}>
                    {signal.takeProfit3Price}
                  </p>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    Risk:Reward 1:{signal.riskReward3}
                  </p>
                </div>
              </>
            )}
          </div>

          {!canSeeAllTPs && (
            <div style={{
              padding: "14px",
              background: "linear-gradient(135deg, #dbeafe, #f3e8ff)",
              borderRadius: "10px",
              border: "1px solid #c7d2fe",
              textAlign: "center",
              marginBottom: "12px",
            }}>
              <p style={{ fontSize: "14px", color: "#1c69e3", fontWeight: "700", marginBottom: "4px" }}>
                🔒 Unlock TP2 & TP3
              </p>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                Upgrade to VIP or VVIP to see all take profit levels
              </p>
            </div>
          )}

          <div style={{
            padding: "10px",
            background: "#f9fafb",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#6b7280",
            textAlign: "center",
          }}>
            Risk: <strong>{signal.riskPips} pips</strong> • Confidence: <strong>{signal.confidence}</strong>
          </div>
        </div>
      )}
    </div>
  );
}