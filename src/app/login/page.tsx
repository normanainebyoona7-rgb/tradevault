"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/providers/theme-provider";

export default function LoginPage() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isDark
        ? "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)"
        : "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #eff6ff 100%)",
      padding: "20px",
    }}>
      <div style={{
        background: isDark ? "#1e293b" : "#ffffff",
        border: `1px solid ${isDark ? "#334155" : "#e5e7eb"}`,
        borderRadius: "16px",
        padding: "32px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
      }}>
        {/* Back to Homepage */}
        <div style={{ marginBottom: "16px" }}>
          <Link href="/" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: isDark ? "#94a3b8" : "#6b7280",
            fontSize: "14px",
            fontWeight: "500",
            textDecoration: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}>
            ← Back to Homepage
          </Link>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img
            src="/logo.png"
            alt="TradeVault"
            style={{
              width: "56px", height: "56px", borderRadius: "12px",
              objectFit: "cover", margin: "0 auto 12px", display: "block",
            }}
          />
          <h1 style={{
            fontSize: "24px", fontWeight: "800",
            color: isDark ? "#f1f5f9" : "#111827",
            marginBottom: "4px",
          }}>
            Welcome Back
          </h1>
          <p style={{ fontSize: "14px", color: isDark ? "#94a3b8" : "#6b7280" }}>
            Sign in to your trading journal
          </p>
        </div>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            color: "#dc2626", padding: "12px", borderRadius: "8px",
            marginBottom: "16px", fontSize: "14px",
          }}>
            {error}
          </div>
        )}

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          style={{
            width: "100%",
            padding: "12px",
            background: isDark ? "#0f172a" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#111827",
            border: `1px solid ${isDark ? "#334155" : "#d1d5db"}`,
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.3s ease",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Sign in with Google
        </button>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}>
          <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
          <span style={{ fontSize: "12px", color: "#6b7280" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block", fontSize: "14px", fontWeight: "600",
              marginBottom: "6px", color: isDark ? "#f1f5f9" : "#111827",
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              style={{
                width: "100%", padding: "12px",
                border: `1px solid ${isDark ? "#334155" : "#d1d5db"}`,
                borderRadius: "8px", fontSize: "14px",
                background: isDark ? "#0f172a" : "#ffffff",
                color: isDark ? "#f1f5f9" : "#111827",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "8px" }}>
            <label style={{
              display: "block", fontSize: "14px", fontWeight: "600",
              marginBottom: "6px", color: isDark ? "#f1f5f9" : "#111827",
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%", padding: "12px",
                border: `1px solid ${isDark ? "#334155" : "#d1d5db"}`,
                borderRadius: "8px", fontSize: "14px",
                background: isDark ? "#0f172a" : "#ffffff",
                color: isDark ? "#f1f5f9" : "#111827",
                outline: "none",
              }}
            />
          </div>

          {/* Forgot Password Link */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "20px",
          }}>
            <Link
              href="/forgot-password"
              style={{
                color: "#1c69e3",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #1c69e3, #783ff5)",
              color: "#fff", border: "none", borderRadius: "8px",
              fontSize: "16px", fontWeight: "700", cursor: "pointer",
              boxShadow: "0 10px 25px rgba(28,105,227,0.3)",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{
          textAlign: "center", marginTop: "16px",
          fontSize: "14px", color: isDark ? "#94a3b8" : "#6b7280",
        }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#1c69e3", fontWeight: "600" }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}