import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Boxes,
  Crosshair,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Waves,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { LiveChart } from "@/components/charts/LiveChart";
import { ApiError, apiError, apiFetch, readJson } from "./api";

interface TradeVaultUser {
  id: string;
  name: string;
  email: string;
  tier?: string;
  isAdmin?: boolean;
}

interface SessionResponse {
  user: TradeVaultUser | null;
}

interface AuthResponse {
  user?: TradeVaultUser;
  error?: string;
  message?: string;
}

const ENGINE_CHECKS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Boxes,
    title: "Supply & demand zones",
    body: "Base candles followed by explosive departures, filtered by distance to live price.",
  },
  {
    icon: Layers3,
    title: "Order blocks & FVGs",
    body: "Institutional entry blocks and fair value gaps drawn directly on the chart.",
  },
  {
    icon: Waves,
    title: "Liquidity",
    body: "Buy-side and sell-side pools with sweep detection on wick rejections.",
  },
  {
    icon: Crosshair,
    title: "Market structure",
    body: "BOS and CHoCH labels from confirmed swings, with a clear trend bias.",
  },
  {
    icon: Gauge,
    title: "Premium / discount",
    body: "Dealing range, equilibrium and OTE to keep entries on the correct side.",
  },
  {
    icon: ShieldCheck,
    title: "Risk model",
    body: "ATR-based stops, 1R / 1.5R / 3R targets and cross-source price checks.",
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5" aria-label="TradeVault AI">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg viewBox="0 0 64 64" className="h-6 w-6" fill="none" aria-hidden="true">
          <rect x="14" y="34" width="7" height="14" rx="2" fill="white" fillOpacity="0.55" />
          <rect x="25" y="26" width="7" height="22" rx="2" fill="white" fillOpacity="0.8" />
          <rect x="36" y="30" width="7" height="18" rx="2" fill="white" fillOpacity="0.65" />
          <path d="M15 26L26 18L35 23L45 13" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M45 13H39.5M45 13V18.5" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-heading text-xl font-bold tracking-tight text-foreground">
        Trade<span className="text-primary">Vault</span>
        <span className="ml-1.5 rounded-md bg-accent px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wider text-primary">AI</span>
      </span>
    </div>
  );
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function App() {
  const [phase, setPhase] = useState<"checking" | "login" | "ready">("checking");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<TradeVaultUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let active = true;

    apiFetch("/api/session")
      .then(async (response) => {
        if (!response.ok) throw await apiError(response, "Could not verify your session.");
        return readJson<SessionResponse>(response);
      })
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        setPhase(data.user ? "ready" : "login");
      })
      .catch((reason) => {
        if (!active) return;
        setError(messageFrom(reason, "Could not connect to TradeVault."));
        setPhase("login");
      });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      if (authMode === "register") {
        const registerResponse = await apiFetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!registerResponse.ok) throw await apiError(registerResponse, "Registration failed.");
      }

      const loginResponse = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginResponse.ok) throw await apiError(loginResponse, "Login failed.");

      const data = await readJson<AuthResponse>(loginResponse);
      setPassword("");
      setUser(data.user ?? null);
      setPhase("ready");

      const sessionResponse = await apiFetch("/api/session");
      if (sessionResponse.ok) {
        const session = await readJson<SessionResponse>(sessionResponse);
        if (session.user) setUser(session.user);
      }
    } catch (reason) {
      setError(messageFrom(reason, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch {
    } finally {
      setUser(null);
      setEmail("");
      setPassword("");
      setError("");
      setSubmitting(false);
      setPhase("login");
    }
  };

  if (phase === "checking") {
    return (
      <div className="auth-background flex min-h-screen min-h-dvh items-center justify-center px-6 text-foreground">
        <div className="flex flex-col items-center gap-6 text-center">
          <Brand />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Opening your AI workspace…</p>
        </div>
      </div>
    );
  }

  if (phase === "login") {
    return (
      <div className="auth-background min-h-screen min-h-dvh px-4 py-8 text-foreground sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-7 flex justify-center">
            <Brand />
          </div>

          {!online && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
              <WifiOff className="h-4 w-4" />
              You are offline. Reconnect to sign in.
            </div>
          )}

          <div className="auth-card rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
                {authMode === "login" ? <ScanSearch className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">
                {authMode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {authMode === "login"
                  ? "Sign in to analyze live markets with TradeVault AI."
                  : "Start your secure TradeVault AI workspace."}
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === "register" && (
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-foreground">Full name</label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    required
                    className="h-12 w-full rounded-lg border border-border bg-background px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    required
                    className="h-12 w-full rounded-lg border border-border bg-background pl-10 pr-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">Password</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={authMode === "register" ? 8 : undefined}
                    required
                    className="h-12 w-full rounded-lg border border-border bg-background pl-10 pr-12 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !online}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 text-sm font-bold text-white shadow-glow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : authMode === "login" ? <Sparkles className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {submitting ? "Please wait…" : authMode === "login" ? "Open TradeVault AI" : "Create account"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {authMode === "login" ? "New to TradeVault?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode((mode) => mode === "login" ? "register" : "login");
                  setError("");
                }}
                className="font-bold text-primary hover:text-primary-hover"
              >
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
            {[
              { icon: TrendingUp, label: "Live charts" },
              { icon: Sparkles, label: "AI analysis" },
              { icon: ShieldCheck, label: "Secure vault" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-2 py-3">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-background text-foreground">
      <header className="mobile-safe-top sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Brand />
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {user?.isAdmin ? "ADMIN" : (user?.tier || "free").toUpperCase()}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={submitting}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-primary disabled:opacity-60"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 border-t border-warning/20 bg-warning/10 px-4 py-2 text-xs font-bold text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — live prices and analysis are paused.
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-3 py-5 sm:px-6 sm:py-7">
        <section className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              TradeVault intelligence
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI chart analysis</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Live SMC, ICT and supply-and-demand confluences using the same candles, zones, order blocks, gaps and structure you see on screen.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold sm:hidden">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {user?.isAdmin ? "ADMIN" : (user?.tier || "free").toUpperCase()}
          </div>
        </section>

        <LiveChart initialPair="XAU/USD" />

        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="mb-4 flex items-center gap-2 px-1">
            <ScanSearch className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">What every analysis checks</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ENGINE_CHECKS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mobile-safe-bottom px-1 pb-3 pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
          Analysis is rule-based, not a guarantee of returns. Live execution only occurs through your explicitly armed admin broker configuration.
        </footer>
      </main>
    </div>
  );
}
