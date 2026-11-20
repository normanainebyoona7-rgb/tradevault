"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CreditCard,
  Lock,
  Palette,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";

export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        setSession(data.user);
        setName(data.user?.name || "");
      });
  }, []);

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, plan and account security
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Signed in as{" "}
          <span className="max-w-[180px] truncate text-primary">{session.email}</span>
        </div>
      </div>

      {session.email === "normanainebyoona7@gmail.com" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-accent p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-accent-foreground">Admin access</p>
              <p className="text-xs text-muted-foreground">Manage users and signals</p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95"
          >
            Admin panel
          </Link>
        </div>
      )}

      {/* Profile */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Email</label>
            <input
              type="email"
              value={session.email}
              disabled
              className="h-10 w-full cursor-not-allowed rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground outline-none"
            />
          </div>

          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60">
            Save profile
          </button>
        </div>
      </section>

      {/* Subscription */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Subscription plans</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-bold">VIP Monthly</p>
              <p className="text-sm text-muted-foreground">UGX 55,000 / 30 days</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60">
              Pay now
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                VVIP Monthly
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  Premium
                </span>
              </p>
              <p className="text-sm text-muted-foreground">UGX 150,000 / 30 days</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60">
              Pay now
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-muted p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Smartphone className="h-4 w-4 text-primary" />
            Pay via mobile money
          </p>
          <p className="text-sm text-muted-foreground">
            Airtel: <strong className="text-foreground">0701179229</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            MTN: <strong className="text-foreground">0783362906</strong>
          </p>
        </div>
      </section>

      {/* Notifications / Appearance / Security */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Signal alerts and account updates are delivered in-app and through the
            Telegram bot linked to your account.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Appearance</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Switch between light and dark themes from the theme toggle in the header.
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Security</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your email address is used as your sign-in identifier and cannot be changed
          from this page.
        </p>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <h2 className="text-base font-bold tracking-tight text-rose-700 dark:text-rose-400">
            Danger zone
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated trading data.
          </p>
          <button className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-400">
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
