"use client";

import { useState, useRef, useEffect } from "react";
import { TradingViewChart } from "@/components/charts/tradingview-chart";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD", "GBP/JPY"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];
const ADMIN_EMAIL = "normanainebyoona7@gmail.com";

export default function AIAnalysisPage() {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [currentPair, setCurrentPair] = useState("XAU/USD");
  const [currentTimeframe, setCurrentTimeframe] = useState("1H");
  const [manualPrice, setManualPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signal, setSignal] = useState<any>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if admin
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});

    // Check mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => setImage(event.target?.result as string);
    reader.readAsDataURL(selectedFile);
    setSignal(null);
    setAnalysis(null);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a chart screenshot first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pair", currentPair);
      formData.append("timeframe", currentTimeframe);
      if (manualPrice) formData.append("userPrice", manualPrice);

      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Analysis failed");
        setLoading(false);
        return;
      }

      setSignal(data.signal);
      setAnalysis(data.analysis);
    } catch (err) {
      setError("Something went wrong");
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
        🤖 AI Chart Analysis
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
        Upload screenshot or enter price manually for AI-powered signals.
      </p>

      {/* TradingView Chart with Timeframe */}
      <div style={{ marginBottom: "20px" }}>
        <TradingViewChart
          onPairChange={setCurrentPair}
          onTimeframeChange={setCurrentTimeframe}
        />
      </div>

      {/* Settings */}
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
          <label style={labelStyle}>Current Price (Optional)</label>
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

      {/* Upload Area */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: isMobile ? "16px" : "20px",
        marginBottom: "20px",
      }}>
        {!image ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed #d1d5db",
              borderRadius: "8px",
              padding: isMobile ? "20px" : "30px",
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <p style={{ fontSize: "16px", color: "#6b7280" }}>
              📸 Click to upload chart screenshot
            </p>
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
              AI will analyze the market and generate signals
            </p>
          </div>
        ) : (
          <div>
            <img
              src={image}
              alt="Chart screenshot"
              style={{
                maxHeight: isMobile ? "200px" : "250px",
                margin: "0 auto 16px",
                display: "block",
                borderRadius: "8px",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                style={{
                  padding: "12px 24px",
                  background: "#7c3aed",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {loading ? "Analyzing..." : "🔍 Analyze Chart"}
              </button>
              <button
                onClick={() => { setImage(null); setFile(null); }}
                style={{
                  padding: "12px 24px",
                  background: "#e5e7eb",
                  color: "#111827",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

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
            📊 Signal — {currentPair} ({currentTimeframe})
          </h2>

          {/* Signal Score Display */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            padding: "10px",
            background: signal.signalScore >= 70 ? "#f0fdf4" : signal.signalScore >= 50 ? "#fefce8" : "#fef2f2",
            borderRadius: "8px",
          }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>
              Confidence Score:
            </span>
            <span style={{
              fontSize: "18px",
              fontWeight: "800",
              color: signal.signalScore >= 70 ? "#16a34a" : signal.signalScore >= 50 ? "#ca8a04" : "#dc2626",
            }}>
              {signal.signalScore}/100
            </span>
            <span style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "700",
              background: signal.confidence === "HIGH" ? "#dcfce7" : signal.confidence === "MEDIUM" ? "#fef9c3" : "#fee2e2",
              color: signal.confidence === "HIGH" ? "#16a34a" : signal.confidence === "MEDIUM" ? "#ca8a04" : "#dc2626",
            }}>
              {signal.confidence}
            </span>
          </div>

          {/* Main Signal Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}>
            <div style={{ padding: "14px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Direction</p>
              <p style={{ fontSize: "20px", fontWeight: "800", color: signal.direction === "long" ? "#16a34a" : "#dc2626" }}>
                {signal.direction?.toUpperCase()}
              </p>
            </div>
            <div style={{ padding: "14px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Entry</p>
              <p style={{ fontSize: "20px", fontWeight: "800" }}>{signal.entryPrice || signal.entryZone}</p>
            </div>
            <div style={{ padding: "14px", background: "#fef2f2", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Stop Loss</p>
              <p style={{ fontSize: "20px", fontWeight: "800", color: "#dc2626" }}>{signal.stopLossPrice || signal.stopLoss}</p>
            </div>
            <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>TP1</p>
              <p style={{ fontSize: "20px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit1Price || signal.takeProfit1}</p>
            </div>
          </div>

          {/* TP2 and TP3 - Only show if available */}
          {(signal.takeProfit2Price || signal.takeProfit2) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              marginTop: "10px",
            }}>
              <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#6b7280" }}>TP2</p>
                <p style={{ fontSize: "20px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit2Price || signal.takeProfit2}</p>
              </div>
              <div style={{ padding: "14px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#6b7280" }}>TP3</p>
                <p style={{ fontSize: "20px", fontWeight: "800", color: "#16a34a" }}>{signal.takeProfit3Price || signal.takeProfit3}</p>
              </div>
            </div>
          )}

          {/* Multi-Timeframe Consensus - Simple display */}
          {signal.multiTimeframeConsensus && (
            <div style={{
              marginTop: "16px",
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "8px",
              textAlign: "center",
            }}>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Multi-Timeframe Analysis</p>
              <p style={{ fontSize: "16px", fontWeight: "700", color: "#1c69e3" }}>
                {signal.multiTimeframeConsensus?.toUpperCase()} ({signal.multiTimeframeStrength}% alignment)
              </p>
            </div>
          )}

          {/* Admin Only - Technical Details */}
          {isAdmin && (
            <div style={{
              marginTop: "16px",
              padding: "16px",
              background: "#faf5ff",
              borderRadius: "8px",
              border: "1px solid #e9d5ff",
            }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#7c3aed", marginBottom: "12px" }}>
                🔧 Admin Technical Analysis
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                <div><strong>RSI:</strong> {signal.rsi}</div>
                <div><strong>ATR:</strong> {signal.atr}</div>
                <div><strong>MA20:</strong> {signal.ma20}</div>
                <div><strong>MA50:</strong> {signal.ma50}</div>
                <div><strong>MA200:</strong> {signal.ma200}</div>
                <div><strong>MACD:</strong> {signal.macd}</div>
                <div><strong>MACD Signal:</strong> {signal.macdSignal}</div>
                <div><strong>MACD Histogram:</strong> {signal.macdHistogram}</div>
                <div><strong>Bollinger Upper:</strong> {signal.bollingerUpper}</div>
                <div><strong>Bollinger Lower:</strong> {signal.bollingerLower}</div>
                <div><strong>Support:</strong> {signal.supportLevel}</div>
                <div><strong>Resistance:</strong> {signal.resistanceLevel}</div>
                <div><strong>Session:</strong> {signal.session}</div>
                <div><strong>Trend:</strong> {signal.trendBias}</div>
              </div>

              {/* Signal Reasons */}
              {signal.reasons && signal.reasons.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>
                    Signal Reasons:
                  </h4>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {signal.reasons.map((reason: string, i: number) => (
                      <li key={i} style={{ padding: "4px 0" }}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Candlestick Patterns */}
              {signal.patterns && signal.patterns.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>
                    Detected Patterns:
                  </h4>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {signal.patterns.map((pattern: any, i: number) => (
                      <li key={i} style={{ padding: "4px 0" }}>
                        • {pattern.name} ({pattern.type}, Strength: {pattern.strength}/10)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Backtest Results */}
              {signal.backtest && (
                <div style={{ marginTop: "12px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>
                    Backtest Results:
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
                    <div>Win Rate: <strong>{signal.backtest.winRate}%</strong></div>
                    <div>Profit Factor: <strong>{signal.backtest.profitFactor}</strong></div>
                    <div>Total Trades: <strong>{signal.backtest.totalTrades}</strong></div>
                    <div>Max Drawdown: <strong>${signal.backtest.maxDrawdown}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {analysis && (
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: isMobile ? "16px" : "20px",
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px" }}>
            📊 AI Professional Analysis
          </h2>
          <p style={{
            fontSize: "14px",
            color: "#111827",
            whiteSpace: "pre-wrap",
            lineHeight: "1.8",
          }}>
            {analysis}
          </p>
        </div>
      )}
    </div>
  );
}