"use client";

import { useState, useEffect } from "react";
import { TradingViewChart } from "@/components/charts/tradingview-chart";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

export default function AIAnalysisPage() {
  const [currentPair, setCurrentPair] = useState("XAU/USD");
  const [currentTimeframe, setCurrentTimeframe] = useState("1H");
  const [manualPrice, setManualPrice] = useState("");
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
          ...(manualPrice ? { userPrice: manualPrice } : {}),
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
        🤖 AI Signal Analysis
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
        Multi-confluence strategy: trend + MACD + RSI + ADX + liquidity-based SL/TP.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <TradingViewChart
          onPairChange={setCurrentPair}
          onTimeframeChange={setCurrentTimeframe}
        />
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginBottom: "20px",
      }}>
        <div>
          <label style={labelStyle}>Timeframe</label>
          <select value={currentTimeframe} onChange={(e) => setCurrentTimeframe(e.target.value)} style={inputStyle}>
            {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Current Price (optional)</label>
          <input
            type="number"
            step="any"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            placeholder="Leave empty for live price"
            style={inputStyle}
          />
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
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>
            📊 {currentPair} ({currentTimeframe})
          </h2>

          {/* Direction badge */}
          <div style={{
            padding: "14px",
            borderRadius: "12px",
            marginBottom: "16px",
            textAlign: "center",
            background: signal.direction === "long" ? "#f0fdf4" : signal.direction === "short" ? "#fef2f2" : "#fef9c3",
            border: `2px solid ${signal.direction === "long" ? "#16a34a" : signal.direction === "short" ? "#dc2626" : "#ca8a04"}`,
          }}>
            <p style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "4px" }}>
              📋 DIRECTION
            </p>
            <p style={{
              fontSize: isMobile ? "22px" : "26px",
              fontWeight: "800",
              color: signal.direction === "long" ? "#16a34a" : signal.direction === "short" ? "#dc2626" : "#ca8a04",
              letterSpacing: "1px",
            }}>
              {signal.direction === "neutral" ? "⏸️ NEUTRAL" : signal.direction === "long" ? "📈 LONG" : "📉 SHORT"}
            </p>
            {signal.direction !== "neutral" && (
              <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                {signal.confidence} confidence • Score {signal.signalScore}/100
              </p>
            )}
          </div>

          {/* Neutral reasons */}
          {signal.direction === "neutral" && (
            <div style={{
              padding: "14px",
              background: "#fef9c3",
              borderRadius: "10px",
              border: "1px solid #fde68a",
              marginBottom: "16px",
            }}>
              <p style={{ fontWeight: "700", color: "#854d0e", marginBottom: "8px", fontSize: "14px" }}>
                ⚠️ No trade — waiting for a clearer setup
              </p>
              {signal.confluences && signal.confluences.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, fontSize: "13px", color: "#854d0e" }}>
                  {signal.confluences.slice(0, 6).map((c: string, i: number) => (
                    <li key={i} style={{ padding: "3px 0" }}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Signal levels */}
          {signal.direction !== "neutral" && (
            <>
              {/* Entry / SL / Current price */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                gap: "10px",
                marginBottom: "12px",
              }}>
                <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280" }}>Current</p>
                  <p style={{ fontSize: "18px", fontWeight: "800" }}>{signal.currentPrice}</p>
                </div>
                <div style={{ padding: "12px", background: "#eff6ff", borderRadius: "8px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280" }}>Entry</p>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#1c69e3" }}>{signal.entryPrice}</p>
                </div>
                <div style={{ padding: "12px", background: "#fef2f2", borderRadius: "8px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280" }}>Stop Loss</p>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#dc2626" }}>{signal.stopLossPrice}</p>
                </div>
              </div>

              {/* TP levels — TP1 always, TP2/TP3 for VIP+ */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : canSeeAllTPs ? "repeat(3, 1fr)" : "1fr",
                gap: "10px",
                marginBottom: "12px",
              }}>
                <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                  <p style={{ fontSize: "11px", color: "#6b7280" }}>TP1</p>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit1Price}</p>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>R:R 1:{signal.riskReward1}</p>
                </div>

                {canSeeAllTPs && (
                  <>
                    <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: "11px", color: "#6b7280" }}>TP2</p>
                      <p style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit2Price}</p>
                      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>R:R 1:{signal.riskReward2}</p>
                    </div>
                    <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: "11px", color: "#6b7280" }}>TP3</p>
                      <p style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit3Price}</p>
                      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>R:R 1:{signal.riskReward3}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Upgrade prompt for free users */}
              {!canSeeAllTPs && (
                <div style={{
                  padding: "12px",
                  background: "linear-gradient(135deg, #dbeafe, #f3e8ff)",
                  borderRadius: "8px",
                  border: "1px solid #c7d2fe",
                  textAlign: "center",
                  marginBottom: "12px",
                }}>
                  <p style={{ fontSize: "13px", color: "#1c69e3", fontWeight: "600" }}>
                    🔒 Unlock TP2 & TP3 with VIP membership
                  </p>
                </div>
              )}

              {/* Risk info */}
              <div style={{
                padding: "10px",
                background: "#f9fafb",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#6b7280",
                marginBottom: "12px",
                textAlign: "center",
              }}>
                Risk: <strong>{signal.riskPips} pips</strong> • Trend: <strong>{signal.trendBias}</strong> • ADX: <strong>{signal.adx}</strong>
              </div>

              {/* Confluences */}
              {signal.confluences && signal.confluences.length > 0 && (
                <div style={{
                  padding: "12px",
                  background: "#faf5ff",
                  borderRadius: "8px",
                  border: "1px solid #e9d5ff",
                }}>
                  <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "8px", fontSize: "13px" }}>
                    🔗 Confluences
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {signal.confluences.slice(0, 8).map((c: string, i: number) => (
                      <li key={i} style={{ padding: "2px 0" }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}