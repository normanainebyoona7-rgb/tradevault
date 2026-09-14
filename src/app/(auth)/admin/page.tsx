"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TradingViewChart } from "@/components/charts/tradingview-chart";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";
const ADMIN_PASSWORD = "norman2026";
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [signals, setSignals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "signals" | "auto" | "analytics">("signals");
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [autoPair, setAutoPair] = useState("XAU/USD");
  const [autoTimeframe, setAutoTimeframe] = useState("1H");
  const [autoPrice, setAutoPrice] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState<any>(null);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [newSignal, setNewSignal] = useState({
    pair: "EUR/USD",
    direction: "long",
    entry: "",
    stopLoss: "",
    takeProfit1: "",
    takeProfit2: "",
    takeProfit3: "",
  });

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    tier: "free",
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/session");
        const data = await response.json();
        if (data.user && data.user.email === ADMIN_EMAIL) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Admin check failed:", error);
      } finally {
        setIsChecking(false);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin && !isLocked) {
      loadSignals();
      loadUsers();
      loadAnalytics();
    }
  }, [isAdmin, isLocked]);

  const loadSignals = async () => {
    setLoadingSignals(true);
    try {
      const response = await fetch("/api/signals");
      const data = await response.json();
      if (response.ok && data.signals) {
        setSignals(data.signals);
      }
    } catch (error) {
      console.error("Failed to load signals:", error);
    } finally {
      setLoadingSignals(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (response.ok && data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch("/api/admin/analytics");
      const data = await response.json();
      if (response.ok) {
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleUnlock = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsLocked(false);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password");
    }
  };

  // ===== AUTO ANALYSIS (Option A: pure live data, no image) =====
  const handleAutoAnalysis = async () => {
    setAutoLoading(true);
    setAutoResult(null);
    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: autoPair,
          timeframe: autoTimeframe,
          ...(autoPrice ? { userPrice: autoPrice } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.signal) {
        console.error("Analysis failed:", data);
        alert(data.message || data.error || "Analysis failed");
        return;
      }

      setAutoResult(data.signal);

      // Save signal (skip if neutral — API handles that)
      const signalToSave = {
        pair: autoPair,
        direction: data.signal.direction,
        entry: String(data.signal.entryPrice ?? ""),
        stopLoss: String(data.signal.stopLossPrice ?? ""),
        takeProfit1: String(data.signal.takeProfit1Price ?? ""),
        takeProfit2: String(data.signal.takeProfit2Price ?? ""),
        takeProfit3: String(data.signal.takeProfit3Price ?? ""),
        isAutoGenerated: true,
        orderType: data.signal.orderType || "MARKET",
        orderTypeDescription: data.signal.orderTypeDescription || "",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const saveResponse = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signalToSave),
      });

      const saveData = await saveResponse.json();
      if (saveData.skipped) {
        console.log("Neutral signal — not saved, not sent to Telegram");
      } else {
        loadSignals();
      }
    } catch (error) {
      console.error("Auto analysis failed:", error);
      alert("Analysis failed — check console");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleAddSignal = async () => {
    try {
      const response = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newSignal,
          isAutoGenerated: false,
          orderType: "MARKET",
          orderTypeDescription: "Manual signal entry",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      if (response.ok) {
        setShowAddSignal(false);
        setNewSignal({ pair: "EUR/USD", direction: "long", entry: "", stopLoss: "", takeProfit1: "", takeProfit2: "", takeProfit3: "" });
        loadSignals();
      }
    } catch (error) {
      console.error("Failed to add signal:", error);
    }
  };

  const deleteSignal = async (signalId: string) => {
    try {
      await fetch(`/api/signals/${signalId}`, { method: "DELETE" });
      loadSignals();
    } catch (error) {
      console.error("Failed to delete signal:", error);
    }
  };

  const toggleSignal = async (signalId: string) => {
    try {
      await fetch(`/api/signals/${signalId}`, { method: "PUT" });
      loadSignals();
    } catch (error) {
      console.error("Failed to toggle signal:", error);
    }
  };

  const handleAddUser = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (response.ok) {
        setShowAddUser(false);
        setNewUser({ name: "", email: "", password: "", tier: "free" });
        loadUsers();
      }
    } catch (error) {
      console.error("Failed to add user:", error);
    }
  };

  const activateUser = async (userId: string, tier: string) => {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, durationDays: tier === "free" ? 5 : 30 }),
      });
      loadUsers();
    } catch (error) {
      console.error("Failed to activate user:", error);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return "No expiry";
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = expiry - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m`;
  };

  if (isChecking) {
    return <div style={{ textAlign: "center", padding: "40px" }}>Checking access...</div>;
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: "center", padding: "60px" }}>
        <p style={{ fontSize: "48px" }}>🔒</p>
        <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>Access Denied</h1>
        <Link href="/dashboard" style={{ color: "#1c69e3" }}>Go to Dashboard</Link>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div style={{ maxWidth: "400px", margin: "0 auto", padding: isMobile ? "40px 16px" : "60px 24px", textAlign: "center" }}>
        <p style={{ fontSize: "48px" }}>🔐</p>
        <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "16px" }}>Admin Login</h1>
        {passwordError && <p style={{ color: "#dc2626", marginBottom: "12px" }}>{passwordError}</p>}
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          placeholder="Enter password"
          style={{ width: "100%", padding: "12px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px" }}
        />
        <button onClick={handleUnlock} style={{ width: "100%", padding: "12px", background: "#1c69e3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>
          Unlock Admin Panel
        </button>
      </div>
    );
  }

  const tabStyle = {
    padding: isMobile ? "8px 12px" : "10px 20px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    border: "none",
    fontSize: isMobile ? "12px" : "14px",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "12px" : "24px" }}>
      <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: "700", marginBottom: isMobile ? "16px" : "24px" }}>⚙️ Admin Panel</h1>

      <div style={{ display: "flex", gap: isMobile ? "6px" : "12px", marginBottom: isMobile ? "16px" : "24px", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("signals")} style={{ ...tabStyle, background: activeTab === "signals" ? "#1c69e3" : "#e5e7eb", color: activeTab === "signals" ? "#fff" : "#111827" }}>
          📊 Signals ({signals.length})
        </button>
        <button onClick={() => setActiveTab("auto")} style={{ ...tabStyle, background: activeTab === "auto" ? "#1c69e3" : "#e5e7eb", color: activeTab === "auto" ? "#fff" : "#111827" }}>
          🤖 Auto Analysis
        </button>
        <button onClick={() => setActiveTab("users")} style={{ ...tabStyle, background: activeTab === "users" ? "#1c69e3" : "#e5e7eb", color: activeTab === "users" ? "#fff" : "#111827" }}>
          👥 Users ({users.length})
        </button>
        <button onClick={() => setActiveTab("analytics")} style={{ ...tabStyle, background: activeTab === "analytics" ? "#1c69e3" : "#e5e7eb", color: activeTab === "analytics" ? "#fff" : "#111827" }}>
          📈 Analytics
        </button>
      </div>

      {activeTab === "signals" && (
        <div>
          <button onClick={() => setShowAddSignal(true)} style={{ marginBottom: "16px", padding: isMobile ? "8px 16px" : "10px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: isMobile ? "12px" : "14px" }}>
            + Add Signal (24h expiry)
          </button>

          {loadingSignals && <p style={{ color: "#6b7280" }}>Loading signals...</p>}

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "500px" : "auto" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Pair</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Direction</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Entry</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Expiry</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal: any) => (
                    <tr key={signal._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px", fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>{signal.pair}</td>
                      <td style={{ padding: "12px", color: signal.direction === "long" ? "#16a34a" : "#dc2626", fontSize: isMobile ? "12px" : "14px" }}>{signal.direction?.toUpperCase()}</td>
                      <td style={{ padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>{signal.entry}</td>
                      <td style={{ padding: "12px", fontSize: isMobile ? "11px" : "12px", color: signal.expiresAt && new Date(signal.expiresAt).getTime() < Date.now() ? "#dc2626" : "#6b7280" }}>
                        {getTimeRemaining(signal.expiresAt)}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {signal.isAutoGenerated ? (
                          <span style={{ padding: "4px 8px", background: "#f3e8ff", color: "#7c3aed", borderRadius: "4px", fontSize: "12px" }}>Auto</span>
                        ) : (
                          <span style={{ padding: "4px 8px", background: "#dbeafe", color: "#1c69e3", borderRadius: "4px", fontSize: "12px" }}>Manual</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => toggleSignal(signal._id)} style={{ padding: "6px 10px", background: signal.isActive ? "#16a34a" : "#6b7280", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>
                            {signal.isActive ? "Active" : "Inactive"}
                          </button>
                          <button onClick={() => deleteSignal(signal._id)} style={{ padding: "6px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {signals.length === 0 && !loadingSignals && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>No signals yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "auto" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: isMobile ? "16px" : "24px" }}>
          <h2 style={{ fontSize: isMobile ? "16px" : "18px", fontWeight: "700", marginBottom: "16px" }}>🤖 Auto Signal Analysis</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            Select pair and timeframe, then generate. Uses live market data — no image needed.
          </p>

          <div style={{ marginBottom: "20px" }}>
            <TradingViewChart
              onPairChange={setAutoPair}
              onTimeframeChange={setAutoTimeframe}
            />
          </div>

          {/* Timeframe selector */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>
              ⏱️ Timeframe
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setAutoTimeframe(tf)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: autoTimeframe === tf ? "#1c69e3" : "#e5e7eb",
                    color: autoTimeframe === tf ? "#fff" : "#111827",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: isMobile ? "12px" : "14px",
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
              Analyzing: <strong>{autoPair}</strong> on <strong>{autoTimeframe}</strong>
            </p>
          </div>

          {/* Manual price (optional) */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
              Current Price (optional — leave empty for live)
            </label>
            <input
              type="number"
              value={autoPrice}
              onChange={(e) => setAutoPrice(e.target.value)}
              placeholder="Auto-detect live price"
              style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" }}
            />
          </div>

          <button
            onClick={handleAutoAnalysis}
            disabled={autoLoading}
            style={{
              width: "100%",
              padding: "14px",
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: autoLoading ? "wait" : "pointer",
              fontSize: "15px",
            }}
          >
            {autoLoading ? "Analyzing..." : "⚡ Generate Signal"}
          </button>

          {autoResult && (
            <div style={{ marginTop: "20px", padding: "16px", background: "#f3e8ff", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: isMobile ? "13px" : "14px" }}>
              <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "12px" }}>
                ✅ Signal — {autoPair} ({autoResult.timeframe || autoTimeframe})
              </p>

              {/* Direction */}
              <div style={{
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "12px",
                textAlign: "center",
                background: autoResult.direction === "long" ? "#dcfce7" : autoResult.direction === "short" ? "#fee2e2" : "#fef9c3",
                border: `2px solid ${autoResult.direction === "long" ? "#16a34a" : autoResult.direction === "short" ? "#dc2626" : "#ca8a04"}`,
              }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280" }}>📋 DIRECTION</p>
                <p style={{
                  fontSize: "22px",
                  fontWeight: "800",
                  color: autoResult.direction === "long" ? "#16a34a" : autoResult.direction === "short" ? "#dc2626" : "#ca8a04",
                }}>
                  {autoResult.direction === "neutral" ? "⏸️ NEUTRAL — NO TRADE" : autoResult.direction?.toUpperCase()}
                </p>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {autoResult.orderTypeDescription}
                </p>
              </div>

              {/* Numbers grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginBottom: "12px",
                padding: "12px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #d8b4fe",
              }}>
                <p>Current: <strong>{autoResult.currentPrice ?? "N/A"}</strong></p>
                <p>Entry: <strong style={{ color: "#1c69e3" }}>{autoResult.entryPrice ?? "N/A"}</strong></p>
                <p>SL: <strong style={{ color: "#dc2626" }}>{autoResult.stopLossPrice ?? "N/A"}</strong></p>
                <p>Risk: <strong>{autoResult.riskPips ?? "N/A"} pips</strong></p>
                <p>TP1: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit1Price ?? "N/A"}</strong></p>
                <p>TP2: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit2Price ?? "N/A"}</strong></p>
                <p>TP3: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit3Price ?? "N/A"}</strong></p>
                <p>Score: <strong>{autoResult.signalScore ?? 0}/100</strong></p>
              </div>

              {/* Confluences */}
              {autoResult.confluences && autoResult.confluences.length > 0 && (
                <div style={{ marginBottom: "12px", padding: "12px", background: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                  <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>🔗 CONFLUENCES:</p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {autoResult.confluences.map((c: string, i: number) => (
                      <li key={i} style={{ padding: "3px 0" }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chart patterns */}
              {autoResult.chartPatterns && autoResult.chartPatterns.length > 0 && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <p style={{ fontWeight: "700", color: "#d97706", marginBottom: "6px", fontSize: "12px" }}>📐 CHART PATTERNS:</p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {autoResult.chartPatterns.map((p: any, i: number) => (
                      <li key={i} style={{ padding: "2px 0" }}>• {p.name} ({p.type}, Strength: {p.strength}/10)</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Supply/Demand */}
              {autoResult.supplyDemandZones && autoResult.supplyDemandZones.length > 0 && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                  <p style={{ fontWeight: "700", color: "#1c69e3", marginBottom: "6px", fontSize: "12px" }}>📦 SUPPLY/DEMAND ZONES:</p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {autoResult.supplyDemandZones.map((z: any, i: number) => (
                      <li key={i} style={{ padding: "2px 0" }}>• {z.type.toUpperCase()} at {z.bottom} - {z.top}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Indicators */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", color: "#6b7280" }}>
                <p>RSI: <strong>{autoResult.rsi || "N/A"}</strong></p>
                <p>ATR: <strong>{autoResult.atr || "N/A"}</strong></p>
                <p>Trend: <strong>{autoResult.trendBias || "N/A"}</strong></p>
                <p>MACD: <strong>{autoResult.macd || "N/A"}</strong></p>
                <p>Support: <strong>{autoResult.supportLevel || "N/A"}</strong></p>
                <p>Resistance: <strong>{autoResult.resistanceLevel || "N/A"}</strong></p>
                <p>Session: <strong>{autoResult.session || "N/A"}</strong></p>
                <p>Source: <strong>{autoResult.dataSource || "N/A"}</strong></p>
              </div>

              {autoResult.direction === "neutral" && (
                <div style={{ marginTop: "12px", padding: "10px", background: "#fef9c3", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <p style={{ fontSize: "12px", color: "#854d0e" }}>
                    ⏸️ Neutral signal — <strong>not saved</strong> to database and <strong>not sent</strong> to Telegram.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div>
          <button onClick={() => setShowAddUser(true)} style={{ marginBottom: "16px", padding: isMobile ? "8px 16px" : "10px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: isMobile ? "12px" : "14px" }}>
            + Add User
          </button>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "400px" : "auto" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>User</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Tier</th>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: isMobile ? "12px" : "14px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px" }}>
                        <p style={{ fontWeight: "600", fontSize: isMobile ? "12px" : "14px" }}>{user.name || "Unknown"}</p>
                        <p style={{ fontSize: isMobile ? "11px" : "12px", color: "#6b7280" }}>{user.email}</p>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600", background: user.tier === "vvip" ? "#f3e8ff" : user.tier === "vip" ? "#dbeafe" : "#e5e7eb", color: user.tier === "vvip" ? "#7c3aed" : user.tier === "vip" ? "#1c69e3" : "#111827" }}>
                          {(user.tier || "free").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => activateUser(user._id, "vip")} style={{ padding: "6px 10px", background: "#1c69e3", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>VIP</button>
                          <button onClick={() => activateUser(user._id, "vvip")} style={{ padding: "6px 10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>VVIP</button>
                          <button onClick={() => activateUser(user._id, "free")} style={{ padding: "6px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Free</button>
                          <button onClick={() => deleteUser(user._id)} style={{ padding: "6px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div>
          {loadingAnalytics && <p style={{ color: "#6b7280" }}>Loading analytics...</p>}

          {analyticsData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Users</p>
                  <p style={{ fontSize: "24px", fontWeight: "800" }}>{analyticsData.platformStats.totalUsers}</p>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Trades</p>
                  <p style={{ fontSize: "24px", fontWeight: "800" }}>{analyticsData.platformStats.totalTrades}</p>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>Total Signals</p>
                  <p style={{ fontSize: "24px", fontWeight: "800" }}>{analyticsData.platformStats.totalSignals}</p>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>Platform P&L</p>
                  <p style={{ fontSize: "24px", fontWeight: "800", color: analyticsData.platformStats.totalPnL >= 0 ? "#16a34a" : "#dc2626" }}>
                    {analyticsData.platformStats.totalPnL >= 0 ? "+" : ""}${analyticsData.platformStats.totalPnL}
                  </p>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "20px" }}>
                <h3 style={{ padding: "16px", fontWeight: "700", fontSize: "16px", borderBottom: "1px solid #e5e7eb" }}>
                  👥 User Performance
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? "600px" : "auto" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>User</th>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>Tier</th>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>Trades</th>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>Win Rate</th>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>P&L</th>
                        <th style={{ textAlign: "left", padding: "10px", fontSize: "12px" }}>Profit Factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.userPerformance.map((user: any) => (
                        <tr key={user.userId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "10px", fontSize: "13px" }}>
                            <p style={{ fontWeight: "600" }}>{user.name}</p>
                            <p style={{ fontSize: "11px", color: "#6b7280" }}>{user.email}</p>
                          </td>
                          <td style={{ padding: "10px" }}>
                            <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600", background: user.tier === "vvip" ? "#f3e8ff" : user.tier === "vip" ? "#dbeafe" : "#e5e7eb", color: user.tier === "vvip" ? "#7c3aed" : user.tier === "vip" ? "#1c69e3" : "#111827" }}>
                              {user.tier.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "10px", fontSize: "13px", fontWeight: "600" }}>{user.totalTrades}</td>
                          <td style={{ padding: "10px", fontSize: "13px", color: user.winRate >= 50 ? "#16a34a" : "#dc2626", fontWeight: "700" }}>
                            {user.winRate}%
                          </td>
                          <td style={{ padding: "10px", fontSize: "13px", fontWeight: "700", color: user.totalPnL >= 0 ? "#16a34a" : "#dc2626" }}>
                            {user.totalPnL >= 0 ? "+" : ""}${user.totalPnL}
                          </td>
                          <td style={{ padding: "10px", fontSize: "13px", fontWeight: "600" }}>
                            {user.profitFactor.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
                <h3 style={{ fontWeight: "700", fontSize: "16px", marginBottom: "16px" }}>
                  📊 Signal Generation Metrics
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "12px" }}>
                  <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#6b7280" }}>Total</p>
                    <p style={{ fontSize: "22px", fontWeight: "800" }}>{analyticsData.signalMetrics.totalSignals}</p>
                  </div>
                  <div style={{ padding: "12px", background: "#f0fdf4", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#6b7280" }}>Active</p>
                    <p style={{ fontSize: "22px", fontWeight: "800", color: "#16a34a" }}>{analyticsData.signalMetrics.activeSignals}</p>
                  </div>
                  <div style={{ padding: "12px", background: "#f3e8ff", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#6b7280" }}>Auto</p>
                    <p style={{ fontSize: "22px", fontWeight: "800", color: "#7c3aed" }}>{analyticsData.signalMetrics.autoGenerated}</p>
                  </div>
                  <div style={{ padding: "12px", background: "#dbeafe", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#6b7280" }}>Manual</p>
                    <p style={{ fontSize: "22px", fontWeight: "800", color: "#1c69e3" }}>{analyticsData.signalMetrics.manualSignals}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showAddSignal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: isMobile ? "16px" : "24px", maxWidth: "400px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontWeight: "700", marginBottom: "16px", fontSize: isMobile ? "16px" : "18px" }}>Add New Signal</h3>
            <select value={newSignal.pair} onChange={(e) => setNewSignal({ ...newSignal, pair: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }}>
              {["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD", "ETH/USD"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={newSignal.direction} onChange={(e) => setNewSignal({ ...newSignal, direction: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }}>
              <option value="long">Long (Buy)</option>
              <option value="short">Short (Sell)</option>
            </select>
            <input type="text" placeholder="Entry Price" value={newSignal.entry} onChange={(e) => setNewSignal({ ...newSignal, entry: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="text" placeholder="Stop Loss" value={newSignal.stopLoss} onChange={(e) => setNewSignal({ ...newSignal, stopLoss: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="text" placeholder="TP1" value={newSignal.takeProfit1} onChange={(e) => setNewSignal({ ...newSignal, takeProfit1: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="text" placeholder="TP2" value={newSignal.takeProfit2} onChange={(e) => setNewSignal({ ...newSignal, takeProfit2: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="text" placeholder="TP3" value={newSignal.takeProfit3} onChange={(e) => setNewSignal({ ...newSignal, takeProfit3: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }} />
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleAddSignal} style={{ flex: 1, padding: "10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Add Signal</button>
              <button onClick={() => setShowAddSignal(false)} style={{ flex: 1, padding: "10px", background: "#e5e7eb", color: "#111827", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: isMobile ? "16px" : "24px", maxWidth: "400px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontWeight: "700", marginBottom: "16px", fontSize: isMobile ? "16px" : "18px" }}>Add New User</h3>
            <input type="text" placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "12px", fontSize: "14px" }} />
            <select value={newUser.tier} onChange={(e) => setNewUser({ ...newUser, tier: e.target.value })} style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
              <option value="free">Free (5 days)</option>
              <option value="vip">VIP (30 days)</option>
              <option value="vvip">VVIP (30 days)</option>
            </select>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleAddUser} style={{ flex: 1, padding: "10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Add User</button>
              <button onClick={() => setShowAddUser(false)} style={{ flex: 1, padding: "10px", background: "#e5e7eb", color: "#111827", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}