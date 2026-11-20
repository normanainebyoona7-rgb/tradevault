"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      const loginResponse = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (loginResponse.ok) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/login";
      }
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = "/api/auth/google";
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40";
  const labelClass = "mb-1.5 block text-sm font-semibold text-foreground";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-hero-radial px-4 py-12 text-foreground">
      <div className="w-full max-w-md lg:max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </Link>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:grid-cols-[1fr_1.15fr]">
          {/* Brand panel (display only) */}
          <div className="hidden flex-col justify-between bg-brand-gradient-deep p-8 text-white lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Logo showWordmark={false} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Your trading edge, documented.
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Journal every trade, uncover your stats and grow with AI-driven
                insights.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/85">
                {[
                  "Unlimited trade journal entries",
                  "Real-time analytics and charts",
                  "AI-powered trade analysis",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-white/50">
              Trusted by disciplined traders worldwide.
            </p>
          </div>

          {/* Form panel */}
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="lg:hidden">
                <Logo />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight lg:mt-0">
                Create Account
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Start your trading journal today
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignup}
              className="mb-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Sign up with Google
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                OR
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="register-name" className={labelClass}>
                  Full Name
                </label>
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Norman"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="register-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="register-password" className={labelClass}>
                    Password
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="register-confirm-password" className={labelClass}>
                    Confirm Password
                  </label>
                  <input
                    id="register-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary transition hover:text-primary-hover"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
