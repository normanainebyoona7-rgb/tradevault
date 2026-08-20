"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/providers/theme-provider";

export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";

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
            Forgot Password
          </h1>
          <p style={{ fontSize: "14px", color: isDark ? "#94a3b8" : "#6b7280" }}>
            Enter your email to reset your password
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

        {message && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            color: "#16a34a", padding: "12px", borderRadius: "8px",
            marginBottom: "16px", fontSize: "14px",
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
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
            {loading ? "Sending..." : "Reset Password"}
          </button>
        </form>

        <p style={{
          textAlign: "center", marginTop: "16px",
          fontSize: "14px", color: isDark ? "#94a3b8" : "#6b7280",
        }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "#1c69e3", fontWeight: "600" }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}