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
  Plug,
  Plus,
  Radar,
  Settings,
  Shield,
  ShieldOff,
  StickyNote,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const ADMIN_EMAIL = "normanainebyoona7@gmail.com";
const ADMIN_PASSWORD = "norman2026";
const TIMEFRAMES = ["5m", "15m", "30m", "1H", "4H", "1D"];
const PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "XAU/USD", "XAG/USD", "BTC/USD", "ETH/USD", "GBP/JPY",
];

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
  const [activeTab, setActiveTab] = useState<
    "auto" | "signals" | "users" | "analytics" | "activity" | "broker"
  >("auto");
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

  /* ---- Kill switch state ---- */
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDisabledMessage, setAiDisabledMessage] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  /* ---- Activity state ---- */
  const [activityData, setActivityData] = useState<any>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState("");

  /* ---- Broker state (unchanged) ---- */
  const [broker, setBroker] = useState<any>(null);
  const [brokerExecutions, setBrokerExecutions] = useState<any[]>([]);
  const [executorConfigured, setExecutorConfigured] = useState(false);
  const [brokerSaving, setBrokerSaving] = useState(false);
  const [brokerError, setBrokerError] = useState("");
  const [brokerNotice, setBrokerNotice] = useState("");
  const [brokerForm, setBrokerForm] = useState({
    login: "",
    password: "",
    server: "",
    mode: "paper" as "paper" | "live",
    enabled: false,
    riskPercent: "1",
    maxLot: "0.1",
    maxDailyLossUsd: "50",
    tpLevel: "1",
    symbolSuffix: "",
  });

  /* ---- Manual trade form ---- */
  const [manualTrade, setManualTrade] = useState({
    pair: "EUR/USD",
    direction: "long",
    orderType: "MARKET",
    entry: "",
    stopLoss: "",
    takeProfit1: "",
    takeProfit2: "",
    takeProfit3: "",
    notes: "",
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualNotice, setManualNotice] = useState("");

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
      loadBroker();
      loadAiToggle();
    }
  }, [isAdmin, isLocked]);

  // Auto-refresh activity when that tab is open
  useEffect(() => {
    if (activeTab === "activity" && !isLocked) {
      loadActivity();
      const t = setInterval(loadActivity, 30000);
      return () => clearInterval(t);
    }
  }, [activeTab, isLocked]);

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

  const loadAiToggle = async () => {
    try {
      const response = await fetch("/api/admin/ai-toggle");
      const data = await response.json();
      if (response.ok) {
        setAiEnabled(!!data.aiEnabled);
        setAiDisabledMessage(data.aiDisabledMessage ?? "");
      }
    } catch (error) {
      console.error("Failed to load AI toggle:", error);
    }
  };

  const saveAiToggle = async (nextEnabled: boolean) => {
    setAiSaving(true);
    setAiNotice("");
    try {
      const response = await fetch("/api/admin/ai-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiEnabled: nextEnabled,
          aiDisabledMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");
      setAiEnabled(!!data.aiEnabled);
      setAiDisabledMessage(data.aiDisabledMessage ?? "");
      setAiNotice(nextEnabled ? "AI analysis enabled." : "AI analysis disabled.");
    } catch (error: any) {
      setAiNotice(error?.message || "Failed to save");
    } finally {
      setAiSaving(false);
    }
  };

  const loadActivity = async () => {
    setLoadingActivity(true);
    setActivityError("");
    try {
      const response = await fetch("/api/admin/activity");
      const data = await response.json();
      if (!response.ok) {
        setActivityError(data.error || "Failed to load activity");
        return;
      }
      setActivityData(data);
    } catch (error: any) {
      setActivityError(error?.message || "Failed to load activity");
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadBroker = async () => {
    try {
      const response = await fetch("/api/admin/broker");
      const data = await response.json();
      if (!response.ok) return;
      setExecutorConfigured(!!data.executorConfigured);
      setBrokerExecutions(data.executions ?? []);
      const conn = data.connection;
      setBroker(conn);
      if (conn) {
        setBrokerForm({
          login: conn.login ?? "",
          password: "",
          server: conn.server ?? "",
          mode: conn.mode ?? "paper",
          enabled: !!conn.enabled,
          riskPercent: String(conn.riskPercent ?? 1),
          maxLot: String(conn.maxLot ?? 0.1),
          maxDailyLossUsd: String(conn.maxDailyLossUsd ?? 50),
          tpLevel: String(conn.tpLevel ?? 1),
          symbolSuffix: conn.symbolSuffix ?? "",
        });
      }
    } catch (error) {
      console.error("Failed to load broker connection:", error);
    }
  };

  const saveBroker = async () => {
    setBrokerSaving(true);
    setBrokerError("");
    setBrokerNotice("");
    try {
      const response = await fetch("/api/admin/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: brokerForm.login,
          password: brokerForm.password,
          server: brokerForm.server,
          mode: brokerForm.mode,
          enabled: brokerForm.enabled,
          riskPercent: Number(brokerForm.riskPercent),
          maxLot: Number(brokerForm.maxLot),
          maxDailyLossUsd: Number(brokerForm.maxDailyLossUsd),
          tpLevel: Number(brokerForm.tpLevel),
          symbolSuffix: brokerForm.symbolSuffix,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBrokerError(data.error || "Failed to save broker connection");
        return;
      }
      setBroker(data.connection);
      setBrokerForm((prev) => ({ ...prev, password: "" }));
      setBrokerNotice("Connection saved.");
    } catch (error: any) {
      setBrokerError(error?.message || "Failed to save broker connection");
    } finally {
      setBrokerSaving(false);
    }
  };

  const disconnectBroker = async () => {
    if (!window.confirm("Remove the broker connection? The executor will stop trading.")) return;
    setBrokerError("");
    setBrokerNotice("");
    try {
      const response = await fetch("/api/admin/broker", { method: "DELETE" });
      if (!response.ok) {
        setBrokerError("Failed to disconnect broker");
        return;
      }
      setBroker(null);
      setBrokerForm({
        login: "",
        password: "",
        server: "",
        mode: "paper",
        enabled: false,
        riskPercent: "1",
        maxLot: "0.1",
        maxDailyLossUsd: "50",
        tpLevel: "1",
        symbolSuffix: "",
      });
      setBrokerNotice("Broker disconnected.");
    } catch {
      setBrokerError("Failed to disconnect broker");
    }
  };

  const submitManualTrade = async () => {
    setManualSaving(true);
    setManualError("");
    setManualNotice("");
    try {
      const response = await fetch("/api/admin/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signal",
          pair: manualTrade.pair,
          direction: manualTrade.direction,
          orderType: manualTrade.orderType,
          entry: Number(manualTrade.entry),
          stopLoss: Number(manualTrade.stopLoss),
          takeProfit1: manualTrade.takeProfit1,
          takeProfit2: manualTrade.takeProfit2,
          takeProfit3: manualTrade.takeProfit3,
          notes: manualTrade.notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data.errors ? data.errors.join(", ") : data.error || "Failed";
        setManualError(msg);
        return;
      }
      setManualNotice("Queued. Executor will place it on its next poll.");
      loadSignals();
    } catch (error: any) {
      setManualError(error?.message || "Failed");
    } finally {
      setManualSaving(false);
    }
  };

  const heartbeatAgo = broker?.lastHeartbeatAt
    ? (() => {
        const mins = Math.floor(
          (Date.now() - new Date(broker.lastHeartbeatAt).getTime()) / 60000
        );
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
      })()
    : "never";

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
        body: JSON.stringify({ pair: autoPair, timeframe: autoTimeframe }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAutoError(data.message || data.error || "Analysis failed");
        return;
      }

      setAutoStatus(data.status);
      setAutoResult(data.signal);

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
            : (data.signal.direction || "").toUpperCase(),
          zone: data.signal.zone || null,
          confidence: data.signal.confidence || "",
          score: data.signal.confidenceScore ?? data.signal.score ?? 0,
          session: data.signal.session || data.signal.confluenceBreakdown?.session || "",
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

  const toggleBan = async (userId: string, currentlyBanned: boolean) => {
    const reason = currentlyBanned
      ? ""
      : window.prompt("Reason for ban (optional):") ?? "";
    try {
      await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !currentlyBanned, reason }),
      });
      loadUsers();
    } catch (error) {
      console.error("Failed to toggle ban:", error);
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

  const TABS: {
    id: "auto" | "signals" | "users" | "analytics" | "activity" | "broker";
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: "auto", label: "Zone strategy", icon: Crosshair },
    { id: "signals", label: `Signals (${signals.length})`, icon: Activity },
    { id: "users", label: `Users (${users.length})`, icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "activity", label: "Activity", icon: Eye },
    { id: "broker", label: "Broker", icon: Plug },
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

      {/* ======= GLOBAL AI KILL SWITCH ======= */}
      <div
        className={`${PANEL} ${
          aiEnabled
            ? "border-emerald-500/30"
            : "border-rose-500/40 bg-rose-500/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {aiEnabled ? (
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldOff className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            )}
            <h2 className="text-base font-bold tracking-tight">
              AI analysis: {aiEnabled ? "ENABLED" : "DISABLED"}
            </h2>
            <span className={aiEnabled ? BADGE_POSITIVE : BADGE_NEGATIVE}>
              {aiEnabled ? "LIVE" : "OFF"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => saveAiToggle(!aiEnabled)}
              disabled={aiSaving}
              className={aiEnabled ? BTN_DANGER : BTN_PRIMARY}
            >
              {aiSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : aiEnabled ? (
                <ShieldOff className="h-3.5 w-3.5" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              {aiEnabled ? "Disable AI analysis" : "Enable AI analysis"}
            </button>
            {aiNotice && (
              <span className="text-xs text-muted-foreground">{aiNotice}</span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <label className={LABEL}>Message shown when AI is disabled</label>
          <input
            className={INPUT}
            value={aiDisabledMessage}
            onChange={(e) => setAiDisabledMessage(e.target.value)}
            placeholder="AI analysis is temporarily disabled by the administrator."
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          This does not change the AI itself — when disabled,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/api/analyze-chart</code>{" "}
          returns a 423 with the message above and no analysis is run.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={tabClass(activeTab === tab.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ======= AUTO (unchanged) ======= */}
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
                {PAIRS.map((p) => (
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

          {autoStatus === "signal" && autoResult && autoResult.direction !== "neutral" && (
            <div className="mt-5 rounded-xl border border-primary/30 bg-accent/60 p-4 text-sm">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                <CircleCheck className="h-4 w-4" />
                Zone signal — {autoPair} ({autoTimeframe})
              </p>
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

              <Section icon={Wallet} title="Levels">
                <div className={`grid gap-2 text-xs ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
                  <p>Entry: <strong className="text-primary">{autoResult.entryPrice?.toFixed(5)}</strong></p>
                  <p>SL: <strong className="text-rose-600 dark:text-rose-400">{autoResult.stopLossPrice?.toFixed(5)}</strong></p>
                  <p>Risk: <strong>{autoResult.riskPips} pips</strong></p>
                  <p>TP1: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit1Price?.toFixed(5)}</strong></p>
                  <p>R:R1: <strong>1:{autoResult.riskReward1}</strong></p>
                  {autoResult.takeProfit2Price != null && (
                    <>
                      <p>TP2: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit2Price?.toFixed(5)}</strong></p>
                      <p>R:R2: <strong>1:{autoResult.riskReward2}</strong></p>
                    </>
                  )}
                  {autoResult.takeProfit3Price != null && (
                    <>
                      <p>TP3: <strong className="text-emerald-600 dark:text-emerald-400">{autoResult.takeProfit3Price?.toFixed(5)}</strong></p>
                      <p>R:R3: <strong>1:{autoResult.riskReward3}</strong></p>
                    </>
                  )}
                </div>
              </Section>

              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Signal saved. Telegram posting handled by /api/signals.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= SIGNALS (unchanged) ======= */}
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
                          <span className={`${BADGE_BASE} bg-accent text-accent-foreground`}>
                            {signal.source === "admin-manual" ? "Manual" : "Auto"}
                          </span>
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

      {/* ======= USERS (adds BAN) ======= */}
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
                  <th className={TH}>Status</th>
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
                      {user.banned ? (
                        <span className={BADGE_NEGATIVE}>BANNED</span>
                      ) : (
                        <span className={BADGE_POSITIVE}>ACTIVE</span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => activateUser(user._id, "vip")} className={BTN_CHIP}>VIP</button>
                        <button onClick={() => activateUser(user._id, "vvip")} className={BTN_CHIP}>
                          <Gem className="h-3.5 w-3.5 text-primary" />
                          VVIP
                        </button>
                        <button onClick={() => activateUser(user._id, "free")} className={BTN_CHIP}>Free</button>
                        <button
                          onClick={() => toggleBan(user._id, !!user.banned)}
                          className={user.banned ? BTN_CHIP : BTN_DANGER}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          {user.banned ? "Unban" : "Ban"}
                        </button>
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
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======= ANALYTICS (unchanged) ======= */}
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
            </>
          )}
        </div>
      )}

      {/* ======= ACTIVITY (new) ======= */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className={PANEL}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <Eye className="h-4 w-4 text-primary" />
                Analysis usage
              </h2>
              <button onClick={loadActivity} className={BTN_CHIP}>
                {loadingActivity ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="h-3.5 w-3.5" />
                )}
                Refresh
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-refreshes every 30 seconds while this tab is open.
            </p>
            {activityError && (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-400">
                {activityError}
              </div>
            )}
          </div>

          {activityData && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={Activity}
                  label="Analyses today"
                  value={(activityData.perUser ?? []).reduce((s: number, u: any) => s + (u.today ?? 0), 0)}
                />
                <StatCard
                  icon={BarChart3}
                  label="Last 7 days"
                  value={(activityData.daily ?? []).reduce((s: number, d: any) => s + (d.count ?? 0), 0)}
                />
                <StatCard
                  icon={Users}
                  label="Active users (7d)"
                  value={(activityData.perUser ?? []).filter((u: any) => (u.week ?? 0) > 0).length}
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <h3 className="flex items-center gap-2 border-b border-border px-5 py-4 text-base font-bold tracking-tight">
                  <Layers className="h-4 w-4 text-primary" />
                  Per-user usage
                </h3>
                <div className="overflow-x-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className={TH}>User</th>
                        <th className={TH}>Tier</th>
                        <th className={TH}>Today</th>
                        <th className={TH}>7 days</th>
                        <th className={TH}>Total</th>
                        <th className={TH}>Last analysis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activityData.perUser ?? []).map((u: any) => (
                        <tr key={u.email} className={TBODY_ROW}>
                          <td className={TD}>
                            <p className="font-semibold">{u.name || u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </td>
                          <td className={TD}>
                            <span className={tierBadgeClass(u.tier)}>
                              {(u.tier || "free").toUpperCase()}
                            </span>
                          </td>
                          <td className={`${TD} font-semibold`}>{u.today}</td>
                          <td className={`${TD} font-semibold`}>{u.week}</td>
                          <td className={`${TD} font-semibold`}>{u.total}</td>
                          <td className={`${TD} text-xs text-muted-foreground`}>
                            {u.lastAt ? new Date(u.lastAt).toLocaleString() : "never"}
                            {u.lastPair ? ` · ${u.lastPair}` : ""}
                          </td>
                        </tr>
                      ))}
                      {(activityData.perUser ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                            No analyses yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <h3 className="flex items-center gap-2 border-b border-border px-5 py-4 text-base font-bold tracking-tight">
                  <Timer className="h-4 w-4 text-primary" />
                  Recent alerts (last 50 analyses)
                </h3>
                <div className="max-h-[420px] overflow-y-auto">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}>
                        <th className={TH}>When</th>
                        <th className={TH}>User</th>
                        <th className={TH}>Pair</th>
                        <th className={TH}>TF</th>
                        <th className={TH}>Direction</th>
                        <th className={TH}>Tier at time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activityData.recentAlerts ?? []).map((e: any) => (
                        <tr key={e._id} className={TBODY_ROW}>
                          <td className={`${TD} whitespace-nowrap text-xs text-muted-foreground`}>
                            {new Date(e.createdAt).toLocaleString()}
                          </td>
                          <td className={TD}>
                            <p className="font-semibold">{e.userName || e.userEmail}</p>
                            <p className="text-xs text-muted-foreground">{e.userEmail}</p>
                          </td>
                          <td className={`${TD} font-semibold`}>{e.pair}</td>
                          <td className={TD}>{e.timeframe}</td>
                          <td className={TD}>
                            <span
                              className={
                                e.direction === "LONG"
                                  ? BADGE_POSITIVE
                                  : e.direction === "SHORT"
                                    ? BADGE_NEGATIVE
                                    : BADGE_NEUTRAL
                              }
                            >
                              {e.direction}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className={tierBadgeClass(e.tierAtTime)}>
                              {(e.tierAtTime || "free").toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(activityData.recentAlerts ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                            No activity yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======= BROKER (adds manual trade form) ======= */}
      {activeTab === "broker" && (
        <div className="space-y-4">
          {/* ---- Manual trade ---- */}
          <div className={PANEL}>
            <div className="mb-1 flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold tracking-tight">Manual trade</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Creates a signal the executor picks up on its next poll (~20s).
              Risk-based lot sizing and daily loss caps apply as configured
              below.
            </p>

            {manualError && (
              <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-400">
                {manualError}
              </div>
            )}
            {manualNotice && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {manualNotice}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Pair</label>
                <select
                  className={INPUT}
                  value={manualTrade.pair}
                  onChange={(e) => setManualTrade({ ...manualTrade, pair: e.target.value })}
                >
                  {PAIRS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Direction</label>
                <select
                  className={INPUT}
                  value={manualTrade.direction}
                  onChange={(e) => setManualTrade({ ...manualTrade, direction: e.target.value })}
                >
                  <option value="long">Long (Buy)</option>
                  <option value="short">Short (Sell)</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Entry</label>
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={manualTrade.entry}
                  onChange={(e) => setManualTrade({ ...manualTrade, entry: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>Stop loss</label>
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={manualTrade.stopLoss}
                  onChange={(e) => setManualTrade({ ...manualTrade, stopLoss: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>TP1 (required)</label>
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={manualTrade.takeProfit1}
                  onChange={(e) => setManualTrade({ ...manualTrade, takeProfit1: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>TP2 (optional)</label>
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={manualTrade.takeProfit2}
                  onChange={(e) => setManualTrade({ ...manualTrade, takeProfit2: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>TP3 (optional)</label>
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={manualTrade.takeProfit3}
                  onChange={(e) => setManualTrade({ ...manualTrade, takeProfit3: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>Notes (optional)</label>
                <input
                  className={INPUT}
                  value={manualTrade.notes}
                  onChange={(e) => setManualTrade({ ...manualTrade, notes: e.target.value })}
                  placeholder="Why are you taking this trade?"
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={submitManualTrade}
                disabled={manualSaving}
                className={BTN_PRIMARY}
              >
                {manualSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" />
                )}
                Queue manual trade
              </button>
            </div>
          </div>

          {/* ---- Connection ---- */}
          <div className={PANEL}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold tracking-tight">
                  Exness · MT5 connection
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={broker ? BADGE_POSITIVE : BADGE_NEUTRAL}>
                  {broker ? "CONNECTED" : "NOT CONNECTED"}
                </span>
                {broker && (
                  <span className={broker.enabled ? BADGE_POSITIVE : BADGE_NEUTRAL}>
                    {broker.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                )}
                {broker && (
                  <span className={broker.mode === "live" ? BADGE_NEGATIVE : BADGE_NEUTRAL}>
                    {broker.mode === "live" ? "LIVE" : "PAPER"}
                  </span>
                )}
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              The executor runs on a Windows VPS with the MT5 terminal, polls
              approved signals, and places trades with risk-based lot sizing.
              Paper mode logs every trade without sending an order.
            </p>

            {!executorConfigured && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                EXECUTOR_SECRET is not set on the server. Add it in your
                Vercel/Render environment variables so the executor can
                authenticate.
              </div>
            )}
            {broker?.lastError && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-400">
                Executor error: {broker.lastError}
              </div>
            )}
            {brokerError && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-400">
                {brokerError}
              </div>
            )}
            {brokerNotice && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {brokerNotice}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>MT5 login</label>
                <input
                  className={INPUT}
                  value={brokerForm.login}
                  onChange={(e) => setBrokerForm({ ...brokerForm, login: e.target.value })}
                  placeholder="e.g. 12345678"
                />
              </div>
              <div>
                <label className={LABEL}>MT5 password</label>
                <input
                  className={INPUT}
                  type="password"
                  value={brokerForm.password}
                  onChange={(e) => setBrokerForm({ ...brokerForm, password: e.target.value })}
                  placeholder={
                    broker?.hasPassword
                      ? "Stored — leave empty to keep"
                      : "Trading password (not investor)"
                  }
                />
              </div>
              <div>
                <label className={LABEL}>Server</label>
                <input
                  className={INPUT}
                  value={brokerForm.server}
                  onChange={(e) => setBrokerForm({ ...brokerForm, server: e.target.value })}
                  placeholder="Exness-MT5Real12"
                />
              </div>
              <div>
                <label className={LABEL}>Symbol suffix</label>
                <input
                  className={INPUT}
                  value={brokerForm.symbolSuffix}
                  onChange={(e) => setBrokerForm({ ...brokerForm, symbolSuffix: e.target.value })}
                  placeholder="e.g. m for XAUUSDm — empty if none"
                />
              </div>
              <div>
                <label className={LABEL}>Mode</label>
                <select
                  className={INPUT}
                  value={brokerForm.mode}
                  onChange={(e) =>
                    setBrokerForm({ ...brokerForm, mode: e.target.value as "paper" | "live" })
                  }
                >
                  <option value="paper">Paper — log only, no orders</option>
                  <option value="live">Live — place real orders</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Take profit level</label>
                <select
                  className={INPUT}
                  value={brokerForm.tpLevel}
                  onChange={(e) => setBrokerForm({ ...brokerForm, tpLevel: e.target.value })}
                >
                  <option value="1">TP1 (closest)</option>
                  <option value="2">TP2</option>
                  <option value="3">TP3 (furthest)</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Risk per trade (%)</label>
                <input
                  className={INPUT}
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={brokerForm.riskPercent}
                  onChange={(e) => setBrokerForm({ ...brokerForm, riskPercent: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>Max lot per trade</label>
                <input
                  className={INPUT}
                  type="number"
                  min={0.01}
                  max={50}
                  step={0.01}
                  value={brokerForm.maxLot}
                  onChange={(e) => setBrokerForm({ ...brokerForm, maxLot: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>Max daily loss (USD)</label>
                <input
                  className={INPUT}
                  type="number"
                  min={0}
                  step={1}
                  value={brokerForm.maxDailyLossUsd}
                  onChange={(e) => setBrokerForm({ ...brokerForm, maxDailyLossUsd: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={brokerForm.enabled}
                    onChange={(e) => setBrokerForm({ ...brokerForm, enabled: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Executor enabled
                </label>
              </div>
            </div>

            {brokerForm.enabled && brokerForm.mode === "live" && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                Live mode will place real orders on this Exness account using
                the signals in the Signals tab. Start in paper mode first.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={saveBroker} disabled={brokerSaving} className={BTN_PRIMARY}>
                {brokerSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {broker ? "Save changes" : "Connect account"}
              </button>
              {broker && (
                <button onClick={disconnectBroker} className={BTN_DANGER}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              )}
              {broker && (
                <span className="text-xs text-muted-foreground">
                  Executor heartbeat: {heartbeatAgo}
                </span>
              )}
            </div>
          </div>

          <div className={PANEL}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <Activity className="h-4 w-4 text-primary" />
                Recent executions
              </h3>
              <span className="text-xs text-muted-foreground">
                {brokerExecutions.length} shown
              </span>
            </div>
            {brokerExecutions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                No executions yet. Every paper and live trade the executor
                handles will be listed here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className={THEAD_ROW}>
                      <th className={TH}>When</th>
                      <th className={TH}>Pair</th>
                      <th className={TH}>Side</th>
                      <th className={TH}>Lots</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerExecutions.map((execution) => (
                      <tr key={execution.id} className={TBODY_ROW} title={execution.message || ""}>
                        <td className={`${TD} whitespace-nowrap text-xs text-muted-foreground`}>
                          {new Date(execution.createdAt).toLocaleString()}
                        </td>
                        <td className={`${TD} font-semibold`}>{execution.pair}</td>
                        <td className={TD}>{String(execution.direction || "").toUpperCase()}</td>
                        <td className={`${TD} tabular-nums`}>{Number(execution.lots || 0).toFixed(2)}</td>
                        <td className={TD}>
                          <span
                            className={
                              execution.status === "placed"
                                ? BADGE_POSITIVE
                                : execution.status === "error"
                                  ? BADGE_NEGATIVE
                                  : BADGE_NEUTRAL
                            }
                          >
                            {execution.status}
                          </span>
                        </td>
                        <td className={`${TD} text-xs uppercase text-muted-foreground`}>
                          {execution.mode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======= modals ======= */}
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
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
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