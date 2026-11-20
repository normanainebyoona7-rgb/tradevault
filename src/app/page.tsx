"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calculator,
  Check,
  Crown,
  Globe2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Calculator,
    title: "Position size calculator",
    description:
      "Size every trade precisely across 40+ forex pairs with live risk control.",
  },
  {
    icon: BookOpen,
    title: "Trade journaling",
    description:
      "Log trades in seconds with screenshots, tags, notes and structured reviews.",
  },
  {
    icon: BarChart3,
    title: "Advanced analytics",
    description:
      "Win rate, profit factor, R-multiples and equity curves in one dashboard.",
  },
  {
    icon: Sparkles,
    title: "AI chart analysis",
    description:
      "Upload a chart and get structured, rule-based signal suggestions.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    description:
      "Private accounts, encrypted credentials and no data reselling. Ever.",
  },
  {
    icon: Globe2,
    title: "Multi-market support",
    description:
      "Forex, commodities and crypto pairs — one journal for your whole book.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    note: "Forever",
    features: [
      "Position size calculator",
      "50 trade limit",
      "Basic analytics",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "VIP",
    price: "UGX 55,000",
    note: "One-time payment",
    features: [
      "Unlimited trades",
      "AI chart analysis",
      "Advanced analytics",
    ],
    cta: "Get VIP",
    highlight: true,
  },
  {
    name: "VVIP",
    price: "UGX 150,000",
    note: "One-time payment",
    features: [
      "Everything in VIP",
      "Full AI signals (TP1 · TP2 · TP3)",
      "Priority support",
    ],
    cta: "Get VVIP",
    highlight: false,
  },
];

const stats = [
  { value: "10,000+", label: "Active traders" },
  { value: "1M+", label: "Trades logged" },
  { value: "40+", label: "Forex pairs" },
  { value: "4.9/5", label: "Average rating" },
];

export default function LandingPage() {
  const [freeSignals, setFreeSignals] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/signals")
      .then((res) => res.json())
      .then((data) => {
        if (data.signals) {
          const now = Date.now();
          const expiryTime = 24 * 60 * 60 * 1000;

          const activeSignals = data.signals
            .filter((s: any) => {
              if (s.isActive === false) return false;
              const signalTime = new Date(
                s.createdAt || s.timestamp || Date.now()
              ).getTime();
              return now - signalTime <= expiryTime;
            })
            .slice(0, 3);

          setFreeSignals(activeSignals);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />

          <div className="flex-1" />

          <Link
            href="/calculator"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            Calculator
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Log in
          </Link>
          <ThemeToggle />
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden bg-card">
          <div className="pointer-events-none absolute inset-0 bg-hero-radial" aria-hidden="true" />
          <div
            className="pointer-events-none absolute inset-0 bg-grid-emerald [mask-image:linear-gradient(to_bottom,black,transparent_72%)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              Free position size calculator included
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
              The smartest{" "}
              <span className="text-gradient">forex trading journal</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Track every trade, understand your edge and size positions
              precisely. One clean dashboard built for serious traders.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                Start journaling free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/calculator"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted sm:w-auto"
              >
                <Calculator className="h-4 w-4 text-primary" />
                Try the calculator
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <li className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                No credit card required
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                Free plan forever
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-primary" />
                Cancel anytime
              </li>
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Platform
              </p>
              <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
                Everything you need to trade smarter
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Purpose-built tools designed by traders, for traders.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Free signals */}
        {freeSignals.length > 0 && (
          <section className="border-t border-border bg-muted/40 py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Live preview
                </span>
                <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">
                  Free trading signals
                </h2>
                <p className="mt-3 text-base text-muted-foreground">
                  A sample of our premium signals. Each preview expires after 24 hours.
                </p>
              </div>

              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {freeSignals.map((signal: any, i: number) => {
                  const isLong = signal.direction === "long";
                  return (
                    <div
                      key={signal._id || i}
                      className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold tracking-tight text-foreground">
                          {signal.pair}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            isLong
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {isLong ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {signal.direction}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Entry
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {signal.entry}
                          </p>
                        </div>
                        <div className="rounded-lg bg-destructive/5 px-3 py-2.5 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Stop loss
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-destructive">
                            {signal.stopLoss}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[signal.takeProfit1, signal.takeProfit2, signal.takeProfit3].map(
                          (tp, index) => (
                            <div
                              key={index}
                              className="rounded-lg bg-primary/5 px-2 py-2.5 text-center"
                            >
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                TP{index + 1}
                              </p>
                              <p className="mt-0.5 text-xs font-semibold text-primary">
                                {tp}
                              </p>
                            </div>
                          )
                        )}
                      </div>

                      <Link
                        href="/register"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                      >
                        Get full access
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl bg-brand-gradient-deep px-6 py-12 ring-1 ring-white/10 sm:px-10">
              <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/70">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Pricing
              </p>
              <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                Pay via Airtel: 0701179229 &nbsp;·&nbsp; MTN: 0783362906
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => {
                const inner = (
                  <div className="flex h-full flex-col rounded-[15px] bg-card p-7">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {plan.name}
                      </h3>
                      {plan.highlight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                          <Crown className="h-3 w-3" />
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                      {plan.price}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.note}</p>

                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/register"
                      className={`mt-7 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        plan.highlight
                          ? "bg-brand-gradient text-white hover:opacity-90"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                );

                return plan.highlight ? (
                  <div
                    key={plan.name}
                    className="rounded-2xl bg-brand-gradient p-px shadow-glow"
                  >
                    {inner}
                  </div>
                ) : (
                  <div
                    key={plan.name}
                    className="rounded-2xl border border-border shadow-card"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/calculator" className="hover:text-foreground">
              Calculator
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Register
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TradeVault. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
