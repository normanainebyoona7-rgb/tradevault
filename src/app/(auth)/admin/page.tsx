"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LiveChart } from "@/components/charts/LiveChart";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CircleCheck,
  CirclePause,
  Crosshair,
  Eye,
  Gem,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  Lock,
  LocateFixed,
  Percent,
  Plus,
  Radar,
  Settings,
  Shield,
  StickyNote,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";
const ADMIN_PASSWORD = "norman2026";
const TIMEFRAMES = ["5m", "15m", "30m", "1H", "4H", "1D"];

/* ---------- presentational helpers ---------- */

const PANEL = "rounded-2xl border border-border bg-card p-5 shadow-card";
const ROW = "rounded-xl border border-border bg-card p-4";
const INPUT =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40";
const LABEL = "mb-1.5 block text-sm font-semibold";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-accent";
const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-400";
const BTN_CHIP =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent";
const BADGE_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold";
const BADGE_POSITIVE = `${BADGE_BASE} bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`;
const BADGE_NEGATIVE = `${BADGE_BASE} bg-rose-500/15 text-rose-700 dark:text-rose-400`;
const BADGE_NEUTRAL = `${BADGE_BASE} bg-muted text-muted-foreground`;
const TH = "whitespace-nowrap px-3 py-3 text-left sm:px-4";
const TD = "px-3 py-3 sm:px-4";
const TABLE = "w-full min-w-[560px] text-sm";
const THEAD_ROW =
  "border-b border-border bg-surface text-xs uppercase tracking-wide text-muted-foreground";
const TBODY_ROW = "border-b border-border last:border-0";

function tierBadgeClass(tier?: string) {
  if (tier === "vvip") return BADGE_POSITIVE;
  if (tier === "vip") return `${BADGE_BASE} bg-accent text-accent-foreground`;
  return BADGE_NEUTRAL;
}

function Section({
  icon: Icon,
  title,
  children,
  className = "mb-3",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-muted/60 p-3 ${className}`}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {title}
      </p>
      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className={ROW}>
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

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
  const [autoPair, setAutoPair] = useState("EUR/USD");
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
          signalLabel:
            data.signal.orderType === "MARKET_BUY" ? "BUY"
            : data.signal.orderType === "MARKET_SELL" ? "SELL"
            : data.signal.orderType === "BUY_LIMIT" ? "BUY LIMIT"
            : data.signal.orderType === "SELL_LIMIT" ? "SELL LIMIT"
            : data.signal.orderType === "BUY_STOP" ? "BUY STOP"
            : data.signal.orderType === "SELL_STOP" ? "SELL STOP"
            : (data.signal.direction || "").toUpperCase(),
          zone: data.signal.zone || null,
          confidence: data.signal.confidence || "",
          score: data.signal.confidenceScore ?? data.signal.score ?? 0,
          session:
            data.signal.session ||
            data.signal.confluenceBreakdown?.session ||
            "",
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

  if (isChecking)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking access...
        </div>
      </div>
    );

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            This area is restricted to administrators.
          </p>
          <Link href="/dashboard" className={BTN_SECONDARY}>
            <ArrowLeft className="h-4 w-4" />
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className={`mx-auto w-full max-w-sm ${PANEL} text-center`}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mb-1 text-xl font-bold tracking-tight">Admin login</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Enter the admin password to continue
          </p>
          {passwordError && (
            <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-400">
              {passwordError}
            </p>
          )}
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Enter password"
            className={`${INPUT} mb-3`}
          />
          <button onClick={handleUnlock} className={`${BTN_PRIMARY} w-full`}>
            <Shield className="h-4 w-4" />
            Unlock admin panel
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: "auto" | "signals" | "users" | "analytics"; label: string; icon: LucideIcon }[] = [
    { id: "auto", label: "Zone strategy", icon: Crosshair },
    { id: "signals", label: `Signals (${signals.length})`, icon: Activity },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? "bg-primary text-primary-foreground shadow-glow"
        : "bg-muted text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signals, users and platform analytics
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Settings className="h-3.5 w-3.5 text-primary" />
          Administrator
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabClass(activeTab === tab.id)}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "auto" && (
        <div className={PANEL}>
          <div className="mb-1 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Supply/Demand zone strategy</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Waits for price to reach a zone. Confirms with Large Range Candle (70%), Engulfing (55%), or Pin Bar (45%). SL beyond zone edge. TPs at 2.0 / 3.5 / 6.0 R:R.
          </p>

          <div className="mb-5">
            <LiveChart
              onPairChange={setAutoPair}
              onTimeframeChange={setAutoTimeframe}
              initialPair={autoPair}
              initialTimeframe={autoTimeframe}
            />
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            <div className="min-w-[150px] flex-1">
              <label className={LABEL}>Pair</label>
              <select value={autoPair} onChange={(e) => setAutoPair(e.target.value)} className={INPUT}>
                {["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD", "GBP/JPY"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px] flex-1">
              <label className={LABEL}>Timeframe</label>
              <select value={autoTimeframe} onChange={(e) => setAutoTimeframe(e.target.value)} className={INPUT}>
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={handleZoneAnalysis} disabled={autoLoading} className={`${BTN_PRIMARY} w-full`}>
            {autoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            {autoLoading ? "Analyzing..." : "Analyze zones"}
          </button>

          {autoError && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-400">
              {autoError}
            </div>
          )}

          {/* WATCHING STATE */}
          {autoStatus === "watching" && autoResult && (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                <Eye className="h-4 w-4" />
                Watching — waiting for setup
              </p>
              <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
                {autoError || (autoResult.zone ? `Nearest zone: ${autoResult.zone.type} at ${autoResult.zone.bottom?.toFixed(5)} - ${autoResult.zone.top?.toFixed(5)}` : "")}
              </p>

              {autoResult.zone && (
                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <LocateFixed className="h-3.5 w-3.5" />
                    Nearest zone
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {autoResult.zone.type === "demand" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Demand
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Supply
                      </>
                    )}{" "}
                    {autoResult.zone.bottom?.toFixed(5)} - {autoResult.zone.top?.toFixed(5)}
                  </p>
                  {autoResult.entrySignal && autoResult.entrySignal.type !== "none" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Signal: <strong className="text-foreground">{autoResult.entrySignal.type}</strong> — {autoResult.entrySignal.reason}
                    </p>
                  )}
                  {autoResult.entrySignal && autoResult.entrySignal.type === "none" && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <CirclePause className="h-3.5 w-3.5" />
                      No entry signal yet (need LRC, Engulfing, or Pin Bar)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* NO SETUP STATE */}
          {autoStatus === "no_setup" && (
            <div className="mt-5 rounded-xl border border-dashed border-border px-6 py-8 text-center">
              <Radar className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-bold text-muted-foreground">No zones detected</p>
              <p className="text-xs text-muted-foreground">Try another timeframe or pair.</p>
            </div>
          )}

          {/* SIGNAL STATE */}
          {autoStatus === "signal" && autoResult && autoResult.direction !== "neutral" && (
            <div className="mt-5 rounded-xl border border-primary/30 bg-accent/60 p-4 text-sm">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                <CircleCheck className="h-4 w-4" />
                Zone signal — {autoPair} ({autoTimeframe})
              </p>

              {/* Direction */}
              <div
                className={`mb-3 rounded-xl border-2 p-4 text-center ${
                  autoResult.direction === "long"
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-rose-500/50 bg-rose-500/10"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Direction</p>
                <p
                  className={`flex items-center justify-center gap-2 text-xl font-extrabold ${
                    autoResult.direction === "long"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {autoResult.direction === "long" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {autoResult.direction === "long" ? "BUY (LONG)" : "SELL (SHORT)"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {autoResult.confidence} confidence — score {autoResult.confidenceScore}/100
                </p>
                {autoResult.orderTypeDescription && (
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {autoResult.orderTypeDescription}
                  </p>
                )}
              </div>

              {/* Zone */}
              {autoResult.zone && (
                <Section icon={LocateFixed} title="Zone">
                  <p className="flex items-center gap-1.5 text-xs text-foreground">
                    {autoResult.zone.type === "demand" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Demand Zone
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Supply Zone
                      </>
                    )}
                    : {autoResult.zone.bottom?.toFixed(5)} - {autoResult.zone.top?.toFixed(5)}
                  </p>
                </Section>
              )}

              {/* Entry signal */}
              {autoResult.entrySignal && (
                <Section icon={Target} title="Entry signal">
                  <p className="text-xs text-foreground">
                    <strong>{autoResult.entrySignal.type?.replace(/_/g, " ").toUpperCase()}</strong> — {autoResult.entrySignal.probability}% probability
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {autoResult.entrySignal.reason}
                  </p>
                </Section>
              )}

              {/* Levels */}
              <Section icon={Wallet} title="Levels">
                <div className={`grid gap-2 text-xs ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
                  <p>Entry: <strong className="text-primary">{autoResult.entryPrice?.toFixed(5)}</strong></p>
                  <p>SL: <strong className="text-rose-600 dark:text-rose-400">{autoResult.stopLossPrice?.toFixed(5)}</strong></p>
                  <p>Risk: <strong>{autoResult.riskPips} pips</strong></p>
                  <p>TP1: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit1Price?.toFixed(5)}</strong></p>
                  <p>R:R1: <strong>1:{autoResult.riskReward1}</strong></p>
                  <p>TP2: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit2Price?.toFixed(5)}</strong></p>
                  <p>R:R2: <strong>1:{autoResult.riskReward2}</strong></p>
                  <p>TP3: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit3Price?.toFixed(5)}</strong></p>
                  <p>R:R3: <strong>1:{autoResult.riskReward3}</strong></p>
                </div>
              </Section>

              {/* Confluence breakdown */}
              {autoResult.confluenceBreakdown && (
                <Section icon={Radar} title="Confluence breakdown">
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <p>{autoResult.confluenceBreakdown.supertrendAligned ? "Aligned" : "Not aligned"} Supertrend</p>
                    <p>{autoResult.confluenceBreakdown.rsiAligned ? "Aligned" : "Not aligned"} RSI</p>
                    <p>{autoResult.confluenceBreakdown.smaAligned ? "Aligned" : "Not aligned"} SMA 9/21</p>
                    <p>{autoResult.confluenceBreakdown.vwapAligned ? "Aligned" : "Not aligned"} VWAP</p>
                    <p>{autoResult.confluenceBreakdown.orderBlockNear ? "Nearby" : "None"} Order Block</p>
                    <p>{autoResult.confluenceBreakdown.fvgNear ? "Nearby" : "None"} FVG</p>
                    <p>{autoResult.confluenceBreakdown.roundNumber ? "Nearby" : "None"} Round Number</p>
                    <p>{autoResult.confluenceBreakdown.sessionFavorable ? "Favorable" : "Unfavorable"} Session ({autoResult.confluenceBreakdown.session})</p>
                  </div>
                </Section>
              )}

              {/* Fibonacci */}
              {autoResult.fibonacci && (
                <Section icon={Percent} title="Fibonacci levels">
                  <div className="text-xs text-muted-foreground">
                    <p>Swing: {autoResult.fibonacci.swingStart?.toFixed(5)} → {autoResult.fibonacci.swingEnd?.toFixed(5)} ({autoResult.fibonacci.swingRange?.toFixed(5)} range)</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1">
                      <p>Ext 1.272: <strong>{autoResult.fibonacci.ext_1_272?.toFixed(5)}</strong></p>
                      <p>Ext 1.618: <strong>{autoResult.fibonacci.ext_1_618?.toFixed(5)}</strong></p>
                      <p>Ext 2.0: <strong>{autoResult.fibonacci.ext_2_0?.toFixed(5)}</strong></p>
                      <p>Ret 0.236: <strong>{autoResult.fibonacci.ret_0_236?.toFixed(5)}</strong></p>
                    </div>
                  </div>
                </Section>
              )}

              {/* Position sizing */}
              {autoResult.positionSizing && (
                <Section icon={Wallet} title="Position sizing">
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <p>Account: <strong>${autoResult.positionSizing.accountSize}</strong></p>
                    <p>Risk: <strong>{autoResult.positionSizing.riskPercent}% (${autoResult.positionSizing.riskDollars})</strong></p>
                    <p>Stop Distance: <strong>{autoResult.positionSizing.stopDistancePips} pips</strong></p>
                    <p>Position Size: <strong>{autoResult.positionSizing.lots} lots</strong></p>
                  </div>
                </Section>
              )}

              {/* MTF */}
              {autoResult.mtfNote && (
                <Section icon={Activity} title="MTF confirmation">
                  <p className="text-xs text-muted-foreground">{autoResult.mtfNote}</p>
                </Section>
              )}

              {/* Session */}
              {autoResult.session && (
                <Section icon={Timer} title="Session">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{autoResult.session}</strong> — {autoResult.sessionWeight}
                  </p>
                </Section>
              )}

              {/* Round number */}
              {autoResult.roundNumberNote && (
                <Section icon={Target} title="Round number">
                  <p className="text-xs text-muted-foreground">{autoResult.roundNumberNote}</p>
                </Section>
              )}

              {/* Trade management */}
              {autoResult.tradeManagement && autoResult.tradeManagement.length > 0 && (
                <Section icon={StickyNote} title="Trade management">
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {autoResult.tradeManagement.map((note: string, i: number) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-primary">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Confluences */}
              {autoResult.confluences && autoResult.confluences.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/60 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Notes
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {autoResult.confluences.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Signal saved. Telegram posting handled by /api/signals.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "signals" && (
        <div className="space-y-4">
          <button onClick={() => setShowAddSignal(true)} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" />
            Add signal (24h expiry)
          </button>

          {loadingSignals && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading signals...
            </p>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Pair</th>
                  <th className={TH}>Direction</th>
                  <th className={TH}>Entry</th>
                  <th className={TH}>Expiry</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal: any) => {
                  const expired = signal.expiresAt && new Date(signal.expiresAt).getTime() < Date.now();
                  return (
                    <tr key={signal._id} className={TBODY_ROW}>
                      <td className={`${TD} font-semibold`}>{signal.pair}</td>
                      <td className={TD}>
                        <span className={signal.direction === "long" ? BADGE_POSITIVE : BADGE_NEGATIVE}>
                          {signal.direction?.toUpperCase()}
                        </span>
                      </td>
                      <td className={TD}>{signal.entry}</td>
                      <td className={TD}>
                        <span className={expired ? BADGE_NEGATIVE : BADGE_NEUTRAL}>
                          {getTimeRemaining(signal.expiresAt)}
                        </span>
                      </td>
                      <td className={TD}>
                        {signal.isAutoGenerated ? (
                          <span className={`${BADGE_BASE} bg-accent text-accent-foreground`}>Auto</span>
                        ) : (
                          <span className={BADGE_NEUTRAL}>Manual</span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => toggleSignal(signal._id)}
                            className={
                              signal.isActive
                                ? "inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400"
                                : BTN_CHIP
                            }
                          >
                            <CircleCheck className="h-3.5 w-3.5" />
                            {signal.isActive ? "Active" : "Inactive"}
                          </button>
                          <button onClick={() => deleteSignal(signal._id)} className={BTN_DANGER}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {signals.length === 0 && !loadingSignals && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No signals yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          <button onClick={() => setShowAddUser(true)} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" />
            Add user
          </button>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>User</th>
                  <th className={TH}>Tier</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user._id} className={TBODY_ROW}>
                    <td className={TD}>
                      <p className="font-semibold">{user.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className={TD}>
                      <span className={tierBadgeClass(user.tier)}>
                        {(user.tier || "free").toUpperCase()}
                      </span>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => activateUser(user._id, "vip")} className={BTN_CHIP}>VIP</button>
                        <button onClick={() => activateUser(user._id, "vvip")} className={BTN_CHIP}>
                          <Gem className="h-3.5 w-3.5 text-primary" />
                          VVIP
                        </button>
                        <button onClick={() => activateUser(user._id, "free")} className={BTN_CHIP}>Free</button>
                        <button onClick={() => deleteUser(user._id)} className={BTN_DANGER}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading analytics...
            </p>
          )}

          {analyticsData && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Users} label="Total users" value={analyticsData.platformStats?.totalUsers ?? 0} />
                <StatCard icon={Activity} label="Total trades" value={analyticsData.platformStats?.totalTrades ?? 0} />
                <StatCard icon={Layers} label="Total signals" value={analyticsData.platformStats?.totalSignals ?? 0} />
                <StatCard
                  icon={Wallet}
                  label="Platform P&L"
                  tone={(analyticsData.platformStats?.totalPnL ?? 0) >= 0 ? "positive" : "negative"}
                  value={`${(analyticsData.platformStats?.totalPnL ?? 0) >= 0 ? "+" : ""}$${analyticsData.platformStats?.totalPnL ?? 0}`}
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <h3 className="flex items-center gap-2 border-b border-border px-5 py-4 text-base font-bold tracking-tight">
                  <Users className="h-4 w-4 text-primary" />
                  User performance
                </h3>
                <div className="overflow-x-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className={TH}>User</th>
                        <th className={TH}>Tier</th>
                        <th className={TH}>Trades</th>
                        <th className={TH}>Win Rate</th>
                        <th className={TH}>P&L</th>
                        <th className={TH}>Profit Factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analyticsData.userPerformance ?? []).map((user: any) => (
                        <tr key={user.userId} className={TBODY_ROW}>
                          <td className={TD}>
                            <p className="font-semibold">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </td>
                          <td className={TD}>
                            <span className={tierBadgeClass(user.tier)}>
                              {user.tier?.toUpperCase() ?? "FREE"}
                            </span>
                          </td>
                          <td className={`${TD} font-semibold`}>{user.totalTrades}</td>
                          <td className={TD}>
                            <span className={user.winRate >= 50 ? BADGE_POSITIVE : BADGE_NEGATIVE}>{user.winRate}%</span>
                          </td>
                          <td className={TD}>
                            <span className={user.totalPnL >= 0 ? BADGE_POSITIVE : BADGE_NEGATIVE}>
                              {user.totalPnL >= 0 ? "+" : ""}${user.totalPnL}
                            </span>
                          </td>
                          <td className={`${TD} font-semibold`}>{user.profitFactor?.toFixed(2) ?? "0.00"}</td>
                        </tr>
                      ))}
                      {(analyticsData.userPerformance ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                            No performance data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={PANEL}>
                <h3 className="mb-4 flex items-center gap-2 text-base font-bold tracking-tight">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Signal metrics
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-background p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold tracking-tight">{analyticsData.signalMetrics?.totalSignals ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{analyticsData.signalMetrics?.activeSignals ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-accent p-3 text-center">
                    <p className="text-xs text-muted-foreground">Auto</p>
                    <p className="text-xl font-bold tracking-tight text-primary">{analyticsData.signalMetrics?.autoGenerated ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Manual</p>
                    <p className="text-xl font-bold tracking-tight">{analyticsData.signalMetrics?.manualSignals ?? 0}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showAddSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight">Add new signal</h3>
              <button
                onClick={() => setShowAddSignal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <select value={newSignal.pair} onChange={(e) => setNewSignal({ ...newSignal, pair: e.target.value })} className={INPUT}>
                {["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD", "ETH/USD"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={newSignal.direction} onChange={(e) => setNewSignal({ ...newSignal, direction: e.target.value })} className={INPUT}>
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </select>
              <input type="text" placeholder="Entry Price" value={newSignal.entry} onChange={(e) => setNewSignal({ ...newSignal, entry: e.target.value })} className={INPUT} />
              <input type="text" placeholder="Stop Loss" value={newSignal.stopLoss} onChange={(e) => setNewSignal({ ...newSignal, stopLoss: e.target.value })} className={INPUT} />
              <input type="text" placeholder="TP1" value={newSignal.takeProfit1} onChange={(e) => setNewSignal({ ...newSignal, takeProfit1: e.target.value })} className={INPUT} />
              <input type="text" placeholder="TP2" value={newSignal.takeProfit2} onChange={(e) => setNewSignal({ ...newSignal, takeProfit2: e.target.value })} className={INPUT} />
              <input type="text" placeholder="TP3" value={newSignal.takeProfit3} onChange={(e) => setNewSignal({ ...newSignal, takeProfit3: e.target.value })} className={INPUT} />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={handleAddSignal} className={`${BTN_PRIMARY} flex-1`}>Add signal</button>
              <button onClick={() => setShowAddSignal(false)} className={`${BTN_SECONDARY} flex-1`}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold tracking-tight">Add new user</h3>
              <button
                onClick={() => setShowAddUser(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className={INPUT} />
              <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className={INPUT} />
              <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className={INPUT} />
              <select value={newUser.tier} onChange={(e) => setNewUser({ ...newUser, tier: e.target.value })} className={INPUT}>
                <option value="free">Free (5 days)</option>
                <option value="vip">VIP (30 days)</option>
                <option value="vvip">VVIP (30 days)</option>
              </select>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={handleAddUser} className={`${BTN_PRIMARY} flex-1`}>Add user</button>
              <button onClick={() => setShowAddUser(false)} className={`${BTN_SECONDARY} flex-1`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
