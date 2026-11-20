"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // TODO: Add actual password reset email functionality
      setMessage("Password reset instructions sent to your email!");
      setEmail("");
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-hero-radial px-4 py-12 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo />
            <h1 className="mt-5 text-2xl font-bold tracking-tight">
              Forgot Password
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email to reset your password
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1.5 block text-sm font-semibold text-foreground"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Reset Password"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary transition hover:text-primary-hover"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
