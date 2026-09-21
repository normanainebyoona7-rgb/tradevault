"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TradingViewChart } from "@/components/charts/tradingview-chart";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";
const ADMIN_PASSWORD = "norman2026";
const TIMEFRAMES = ["5m", "15m", "30m", "1H", "4H", "1D"];

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [signals, setSignals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "signals" | "auto" | "analytics">("auto");
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [autoPair, setAutoPair] = useState("XAU/USD");
  const [autoTimeframe, setAutoTimeframe] = useState("1H");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState<any>(null);
  const [autoStatus, setAutoStatus] = useState<"signal" | "watching" | "no_setup" | null>(null);
  const [autoError, setAutoError] = useState("");
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
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/session");
        const data = await response.json();
        if (data.user && data.user.email === ADMIN_EMAIL) setIsAdmin(true);
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
      if (response.ok && data.signals) setSignals(data.signals);
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
      if (response.ok && data.users) setUsers(data.users);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch("/api/admin/analytics");
      const data = await response.json();
      if (response.ok) setAnalyticsData(data);
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

  const handleZoneAnalysis = async () => {
    setAutoLoading(true);
    setAutoResult(null);
    setAutoStatus(null);
    setAutoError("");

    try {
      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: autoPair,
          timeframe: autoTimeframe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAutoError(data.message || data.error || "Analysis failed");
        return;
      }

      setAutoStatus(data.status);
      setAutoResult(data.signal);

      // Only save if status is signal
      if (data.status === "signal" && data.signal?.direction !== "neutral") {
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
        if (!saveData.skipped) loadSignals();
      }
    } catch (error: any) {
      console.error("Zone analysis failed:", error);
      setAutoError(error?.message || "Analysis failed");
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
    const diff = expiry - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${mins}m`;
  };

  if (isChecking) return <div style={{ textAlign: "center", padding: "40px" }}>Checking access...</div>;

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
        <button onClick={() => setActiveTab("auto")} style={{ ...tabStyle, background: activeTab === "auto" ? "#1c69e3" : "#e5e7eb", color: activeTab === "auto" ? "#fff" : "#111827" }}>
          🎯 Zone Strategy
        </button>
        <button onClick={() => setActiveTab("signals")} style={{ ...tabStyle, background: activeTab === "signals" ? "#1c69e3" : "#e5e7eb", color: activeTab === "signals" ? "#fff" : "#111827" }}>
          📊 Signals ({signals.length})
        </button>
        <button onClick={() => setActiveTab("users")} style={{ ...tabStyle, background: activeTab === "users" ? "#1c69e3" : "#e5e7eb", color: activeTab === "users" ? "#fff" : "#111827" }}>
          👥 Users ({users.length})
        </button>
        <button onClick={() => setActiveTab("analytics")} style={{ ...tabStyle, background: activeTab === "analytics" ? "#1c69e3" : "#e5e7eb", color: activeTab === "analytics" ? "#fff" : "#111827" }}>
          📈 Analytics
        </button>
      </div>

      {activeTab === "auto" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: isMobile ? "16px" : "24px" }}>
          <h2 style={{ fontSize: isMobile ? "16px" : "18px", fontWeight: "700", marginBottom: "8px" }}>
            🎯 Supply/Demand Zone Strategy
          </h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            Waits for price to reach a zone. Confirms with Large Range Candle (70%), Engulfing (55%), or Pin Bar (45%). TPs at Fibonacci extensions.
          </p>

          <div style={{ marginBottom: "20px" }}>
            <TradingViewChart onPairChange={setAutoPair} onTimeframeChange={setAutoTimeframe} />
          </div>

          <div style={{ marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "150px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>Pair</label>
              <select
                value={autoPair}
                onChange={(e) => setAutoPair(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" }}
              >
                {["XAU/USD", "EUR/USD", "GBP/USD", "USD/JPY", "XAG/USD", "BTC/USD", "ETH/USD", "GBP/JPY"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: "150px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>Timeframe</label>
              <select
                value={autoTimeframe}
                onChange={(e) => setAutoTimeframe(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" }}
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleZoneAnalysis}
            disabled={autoLoading}
            style={{
              width: "100%",
              padding: "14px",
              background: autoLoading ? "#9ca3af" : "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: autoLoading ? "wait" : "pointer",
              fontSize: "15px",
            }}
          >
            {autoLoading ? "Analyzing..." : "🎯 Analyze Zones"}
          </button>

          {autoError && (
            <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: "8px", marginTop: "16px", fontSize: "14px" }}>
              {autoError}
            </div>
          )}

          {/* WATCHING STATE */}
          {autoStatus === "watching" && autoResult && (
            <div style={{ marginTop: "20px", padding: "16px", background: "#fef9c3", borderRadius: "8px", border: "1px solid #fde68a", fontSize: isMobile ? "13px" : "14px" }}>
              <p style={{ fontWeight: "700", color: "#854d0e", marginBottom: "8px" }}>
                👀 WATCHING — Waiting for setup
              </p>
              <p style={{ color: "#854d0e", fontSize: "13px" }}>
                {autoError || (autoResult.zone ? `Nearest zone: ${autoResult.zone.type} at ${autoResult.zone.bottom?.toFixed(5)} - ${autoResult.zone.top?.toFixed(5)}` : "")}
              </p>

              {autoResult.zone && (
                <div style={{ marginTop: "12px", padding: "10px", background: "#ffffff", borderRadius: "6px" }}>
                  <p style={{ fontWeight: "700", color: "#854d0e", marginBottom: "6px", fontSize: "12px" }}>
                    📍 NEAREST ZONE:
                  </p>
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>
                    {autoResult.zone.type === "demand" ? "🟢 Demand" : "🔴 Supply"} {autoResult.zone.bottom?.toFixed(5)} - {autoResult.zone.top?.toFixed(5)}
                  </p>
                  {autoResult.entrySignal && autoResult.entrySignal.type !== "none" && (
                    <p style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280" }}>
                      Signal: <strong>{autoResult.entrySignal.type}</strong> — {autoResult.entrySignal.reason}
                    </p>
                  )}
                  {autoResult.entrySignal && autoResult.entrySignal.type === "none" && (
                    <p style={{ marginTop: "8px", fontSize: "13px", color: "#854d0e" }}>
                      ⏸️ No entry signal yet (need LRC, Engulfing, or Pin Bar)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* NO SETUP STATE */}
          {autoStatus === "no_setup" && (
            <div style={{ marginTop: "20px", padding: "16px", background: "#f3f4f6", borderRadius: "8px", border: "1px solid #d1d5db", textAlign: "center" }}>
              <p style={{ fontWeight: "700", color: "#6b7280", marginBottom: "8px" }}>
                No zones detected
              </p>
              <p style={{ color: "#6b7280", fontSize: "13px" }}>
                Try another timeframe or pair.
              </p>
            </div>
          )}

          {/* SIGNAL STATE */}
          {autoStatus === "signal" && autoResult && autoResult.direction !== "neutral" && (
            <div style={{ marginTop: "20px", padding: "16px", background: "#f3e8ff", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: isMobile ? "13px" : "14px" }}>
              <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "12px" }}>
                ✅ ZONE SIGNAL — {autoPair} ({autoTimeframe})
              </p>

              {/* Direction */}
              <div style={{
                padding: "14px",
                borderRadius: "8px",
                marginBottom: "12px",
                textAlign: "center",
                background: autoResult.direction === "long" ? "#dcfce7" : "#fee2e2",
                border: `2px solid ${autoResult.direction === "long" ? "#16a34a" : "#dc2626"}`,
              }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280" }}>DIRECTION</p>
                <p style={{ fontSize: "22px", fontWeight: "800", color: autoResult.direction === "long" ? "#16a34a" : "#dc2626" }}>
                  {autoResult.direction === "long" ? "📈 BUY (LONG)" : "📉 SELL (SHORT)"}
                </p>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  {autoResult.confidence} confidence
                </p>
              </div>

              {/* Zone info */}
              {autoResult.zone && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#ffffff", borderRadius: "8px", border: "1px solid #d8b4fe" }}>
                  <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "6px", fontSize: "12px" }}>
                    📍 ZONE
                  </p>
                  <p style={{ fontSize: "13px", color: "#374151" }}>
                    {autoResult.zone.type === "demand" ? "🟢 Demand Zone" : "🔴 Supply Zone"}: {autoResult.zone.bottom?.toFixed(5)} - {autoResult.zone.top?.toFixed(5)}
                  </p>
                </div>
              )}

              {/* Entry signal */}
              {autoResult.entrySignal && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <p style={{ fontWeight: "700", color: "#d97706", marginBottom: "6px", fontSize: "12px" }}>
                    🎯 ENTRY SIGNAL
                  </p>
                  <p style={{ fontSize: "13px", color: "#374151" }}>
                    <strong>{autoResult.entrySignal.type.replace(/_/g, " ").toUpperCase()}</strong> — {autoResult.entrySignal.probability}% probability
                  </p>
                  <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    {autoResult.entrySignal.reason}
                  </p>
                </div>
              )}

              {/* Levels */}
              <div style={{ marginBottom: "12px", padding: "12px", background: "#ffffff", borderRadius: "8px", border: "1px solid #d8b4fe" }}>
                <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "8px", fontSize: "12px" }}>💰 LEVELS</p>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: "8px", fontSize: "13px" }}>
                  <p>Entry: <strong style={{ color: "#1c69e3" }}>{autoResult.entryPrice}</strong></p>
                  <p>SL: <strong style={{ color: "#dc2626" }}>{autoResult.stopLossPrice}</strong></p>
                  <p>Risk: <strong>{autoResult.riskPips} pips</strong></p>
                  <p>TP1: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit1Price}</strong></p>
                  <p>R:R1: <strong>1:{autoResult.riskReward1}</strong></p>
                  <p>TP2: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit2Price}</strong></p>
                  <p>R:R2: <strong>1:{autoResult.riskReward2}</strong></p>
                  <p>TP3: <strong style={{ color: "#16a34a" }}>{autoResult.takeProfit3Price}</strong></p>
                  <p>R:R3: <strong>1:{autoResult.riskReward3}</strong></p>
                </div>
              </div>

              {/* Fibonacci */}
              {autoResult.fibonacci && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                  <p style={{ fontWeight: "700", color: "#1c69e3", marginBottom: "6px", fontSize: "12px" }}>
                    📐 FIBONACCI LEVELS
                  </p>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    <p>Swing: {autoResult.fibonacci.swingStart?.toFixed(5)} → {autoResult.fibonacci.swingEnd?.toFixed(5)} ({autoResult.fibonacci.swingRange?.toFixed(5)} range)</p>
                    <div style={{ marginTop: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                      <p>TP1 (1.272): <strong>{autoResult.fibonacci.ext_1_272?.toFixed(5)}</strong></p>
                      <p>TP2 (1.618): <strong>{autoResult.fibonacci.ext_1_618?.toFixed(5)}</strong></p>
                      <p>TP3 (2.0): <strong>{autoResult.fibonacci.ext_2_0?.toFixed(5)}</strong></p>
                      <p>SL buffer (0.236): <strong>{autoResult.fibonacci.ret_0_236?.toFixed(5)}</strong></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Position sizing */}
              {autoResult.positionSizing && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontWeight: "700", color: "#16a34a", marginBottom: "6px", fontSize: "12px" }}>
                    💰 POSITION SIZING
                  </p>
                  <div style={{ fontSize: "12px", color: "#6b7280", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                    <p>Account: <strong>${autoResult.positionSizing.accountSize}</strong></p>
                    <p>Risk: <strong>{autoResult.positionSizing.riskPercent}% (${autoResult.positionSizing.riskDollars})</strong></p>
                    <p>Stop Distance: <strong>{autoResult.positionSizing.stopDistancePips} pips</strong></p>
                    <p>Position Size: <strong>{autoResult.positionSizing.lots} lots</strong></p>
                  </div>
                </div>
              )}

              {/* MTF */}
              {autoResult.mtfNote && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#f0fdfa", borderRadius: "8px", border: "1px solid #99f6e4" }}>
                  <p style={{ fontWeight: "700", color: "#0d9488", marginBottom: "6px", fontSize: "12px" }}>
                    ⏱️ MTF CONFIRMATION
                  </p>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>{autoResult.mtfNote}</p>
                </div>
              )}

              {/* Session */}
              {autoResult.session && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#fefce8", borderRadius: "8px", border: "1px solid #fde68a" }}>
                  <p style={{ fontWeight: "700", color: "#854d0e", marginBottom: "6px", fontSize: "12px" }}>
                    🕐 SESSION
                  </p>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>
                    <strong>{autoResult.session}</strong> — {autoResult.sessionWeight}
                  </p>
                </div>
              )}

              {/* Round number */}
              {autoResult.roundNumberNote && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#fce7f3", borderRadius: "8px", border: "1px solid #fbcfe8" }}>
                  <p style={{ fontWeight: "700", color: "#be185d", marginBottom: "6px", fontSize: "12px" }}>
                    🎯 ROUND NUMBER
                  </p>
                  <p style={{ fontSize: "12px", color: "#6b7280" }}>{autoResult.roundNumberNote}</p>
                </div>
              )}

              {/* Trade management */}
              {autoResult.tradeManagement && autoResult.tradeManagement.length > 0 && (
                <div style={{ marginBottom: "12px", padding: "10px", background: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                  <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "6px", fontSize: "12px" }}>
                    📌 TRADE MANAGEMENT
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {autoResult.tradeManagement.map((note: string, i: number) => (
                      <li key={i} style={{ padding: "2px 0" }}>• {note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Confluences */}
              {autoResult.confluences && autoResult.confluences.length > 0 && (
                <div style={{ padding: "12px", background: "#f5f3ff", borderRadius: "8px", border: "1px solid #ddd6fe" }}>
                  <p style={{ fontWeight: "700", color: "#7c3aed", marginBottom: "8px" }}>🔗 CONFLUENCES:</p>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "12px", color: "#6b7280" }}>
                    {autoResult.confluences.map((c: string, i: number) => (
                      <li key={i} style={{ padding: "3px 0" }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: "12px", padding: "10px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: "12px", color: "#16a34a" }}>
                  ✅ Signal saved + sent to Telegram.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

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
                          <td style={{ padding: "10px", fontSize: "13px", color: user.winRate >= 50 ? "#16a34a" : "#dc2626", fontWeight: "700" }}>{user.winRate}%</td>
                          <td style={{ padding: "10px", fontSize: "13px", fontWeight: "700", color: user.totalPnL >= 0 ? "#16a34a" : "#dc2626" }}>
                            {user.totalPnL >= 0 ? "+" : ""}${user.totalPnL}
                          </td>
                          <td style={{ padding: "10px", fontSize: "13px", fontWeight: "600" }}>{user.profitFactor.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px" }}>
                <h3 style={{ fontWeight: "700", fontSize: "16px", marginBottom: "16px" }}>📊 Signal Metrics</h3>
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