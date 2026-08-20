"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tradevault_theme");
    if (saved === "dark") {
      setIsDark(true);
      document.body.style.background = "#0f172a";
      document.body.style.color = "#f1f5f9";
    }
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.body.style.background = "#0f172a";
      document.body.style.color = "#f1f5f9";
      localStorage.setItem("tradevault_theme", "dark");
    } else {
      document.body.style.background = "#ffffff";
      document.body.style.color = "#111827";
      localStorage.setItem("tradevault_theme", "light");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: isDark ? "#0f172a" : "#ffffff", transition: "all 0.5s ease" }}>
      {/* Navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e5e7eb",
        height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <img
            src="/logo.png"
            alt="TradeVault"
            style={{
              width: "36px", height: "36px", borderRadius: "8px",
              objectFit: "cover", animation: "float 3s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: "20px", fontWeight: "800", color: isDark ? "#fff" : "#111827" }}>
            Trade<span style={{ color: "#1c69e3" }}>Vault</span>
          </span>
        </Link>

        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px" }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          <Link href="/login" style={{ textDecoration: "none", color: isDark ? "#cbd5e1" : "#6b7280", fontSize: "14px" }}>
            Login
          </Link>
          <Link href="/register" style={{
            textDecoration: "none",
            background: "linear-gradient(135deg, #1c69e3, #783ff5)",
            color: "#fff", padding: "10px 20px", borderRadius: "8px",
            fontSize: "14px", fontWeight: "600",
          }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: "120px 20px 80px", textAlign: "center",
        background: isDark ? "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)" : "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
      }}>
        <div style={{
          display: "inline-block", background: isDark ? "#1e293b" : "#dbeafe",
          color: "#1c69e3", padding: "6px 16px", borderRadius: "999px",
          fontSize: "14px", fontWeight: "600", marginBottom: "16px",
          opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease-out",
        }}>
          ⚡ Free Position Size Calculator Included
        </div>

        <h1 style={{
          fontSize: "42px", fontWeight: "800", marginBottom: "16px",
          color: isDark ? "#fff" : "#111827",
          opacity: isVisible ? 1 : 0, transition: "all 0.8s ease-out 0.2s",
        }}>
          The Smartest{" "}
          <span style={{
            background: "linear-gradient(135deg, #1c69e3, #783ff5)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Forex Trading Journal
          </span>
        </h1>

        <p style={{
          fontSize: "18px", color: isDark ? "#cbd5e1" : "#6b7280",
          maxWidth: "600px", margin: "0 auto 32px",
          opacity: isVisible ? 1 : 0, transition: "all 0.8s ease-out 0.4s",
        }}>
          Track your trades, analyze performance, and calculate position sizes.
          All in one beautiful dashboard built for serious traders.
        </p>

        <div style={{
          display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap",
          opacity: isVisible ? 1 : 0, transition: "all 0.8s ease-out 0.6s",
        }}>
          <Link href="/register" style={{
            textDecoration: "none",
            background: "linear-gradient(135deg, #1c69e3, #783ff5)",
            color: "#fff", padding: "16px 32px", borderRadius: "8px",
            fontSize: "16px", fontWeight: "700",
            boxShadow: "0 10px 25px rgba(28,105,227,0.4)",
          }}>
            🚀 Start Journaling Free
          </Link>
          <Link href="/calculator" style={{
            textDecoration: "none",
            background: isDark ? "#1e293b" : "#ffffff",
            color: isDark ? "#f1f5f9" : "#111827",
            padding: "16px 32px", borderRadius: "8px",
            fontSize: "16px", fontWeight: "700",
            border: "1px solid #d1d5db",
          }}>
            🧮 Try Calculator
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "60px 20px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700", textAlign: "center", color: isDark ? "#fff" : "#111827", marginBottom: "12px" }}>
          Everything You Need to Trade Smarter
        </h2>
        <p style={{ textAlign: "center", color: "#6b7280", marginBottom: "40px" }}>
          Powerful tools designed by traders, for traders.
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px", maxWidth: "1200px", margin: "0 auto",
        }}>
          {[
            { icon: "🧮", title: "Position Size Calculator", desc: "Calculate optimal position sizes with 40+ forex pairs." },
            { icon: "📓", title: "Trade Journaling", desc: "Log trades in seconds with screenshots, tags, and notes." },
            { icon: "📊", title: "Advanced Analytics", desc: "Win rate, profit factor, R-multiples, and more." },
            { icon: "🤖", title: "AI Chart Analysis", desc: "Upload charts and get AI-powered trading signals." },
            { icon: "🛡️", title: "Your Data, Secure", desc: "Your trades are private and encrypted." },
            { icon: "🌍", title: "Multi-Market Support", desc: "Forex, commodities, and crypto." },
          ].map((feature, i) => (
            <div key={i} style={{
              background: isDark ? "#1e293b" : "#ffffff",
              border: "1px solid #e5e7eb", borderRadius: "12px",
              padding: "24px", textAlign: "center",
              transition: "all 0.3s ease", cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-6px)";
              e.currentTarget.style.boxShadow = "0 15px 30px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: "linear-gradient(135deg, #1c69e3, #783ff5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px", fontSize: "24px",
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: isDark ? "#fff" : "#111827", marginBottom: "8px" }}>
                {feature.title}
              </h3>
              <p style={{ color: "#6b7280", fontSize: "14px" }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section style={{
        padding: "60px 20px",
        background: "linear-gradient(-45deg, #1c69e3, #783ff5, #448bff, #00b9a2)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 10s ease infinite",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "20px", maxWidth: "1200px", margin: "0 auto", textAlign: "center",
        }}>
          {[
            { value: "10,000+", label: "Active Traders" },
            { value: "1M+", label: "Trades Logged" },
            { value: "40+", label: "Forex Pairs" },
            { value: "4.9★", label: "User Rating" },
          ].map((stat, i) => (
            <div key={i}>
              <p style={{ fontSize: "32px", fontWeight: "800", color: "#fff" }}>{stat.value}</p>
              <p style={{ color: "rgba(255,255,255,0.8)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "60px 20px" }}>
        <h2 style={{ fontSize: "28px", fontWeight: "700", textAlign: "center", color: isDark ? "#fff" : "#111827", marginBottom: "12px" }}>
          Simple Pricing
        </h2>
        <p style={{ textAlign: "center", color: "#6b7280", marginBottom: "40px" }}>
          Pay via Airtel: 0701179229 | MTN: 0783362906
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px", maxWidth: "1200px", margin: "0 auto",
        }}>
          <div style={{
            background: isDark ? "#1e293b" : "#ffffff",
            border: "1px solid #e5e7eb", borderRadius: "12px",
            padding: "28px", textAlign: "center",
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px", color: isDark ? "#fff" : "#111827" }}>Free</h3>
            <p style={{ fontSize: "32px", fontWeight: "800", marginBottom: "16px", color: isDark ? "#fff" : "#111827" }}>$0</p>
            <ul style={{ listStyle: "none", marginBottom: "24px", color: "#6b7280", fontSize: "14px" }}>
              <li style={{ padding: "6px 0" }}>✅ Position Size Calculator</li>
              <li style={{ padding: "6px 0" }}>✅ 50 Trade Limit</li>
              <li style={{ padding: "6px 0" }}>✅ Basic Analytics</li>
            </ul>
            <Link href="/register" style={{
              textDecoration: "none", display: "block", background: "#e5e7eb",
              color: "#111827", padding: "12px", borderRadius: "8px", fontWeight: "600",
            }}>Start Free</Link>
          </div>

          <div style={{
            background: "linear-gradient(180deg, #1c69e3, #783ff5)", borderRadius: "12px",
            padding: "28px", textAlign: "center", color: "#fff",
            boxShadow: "0 10px 30px rgba(28,105,227,0.3)",
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>VIP</h3>
            <p style={{ fontSize: "32px", fontWeight: "800", marginBottom: "16px" }}>UGX 55,000</p>
            <ul style={{ listStyle: "none", marginBottom: "24px", fontSize: "14px" }}>
              <li style={{ padding: "6px 0" }}>✅ Unlimited Trades</li>
              <li style={{ padding: "6px 0" }}>✅ AI Chart Analysis</li>
              <li style={{ padding: "6px 0" }}>✅ Advanced Analytics</li>
            </ul>
            <Link href="/register" style={{
              textDecoration: "none", display: "block", background: "#fff",
              color: "#1c69e3", padding: "12px", borderRadius: "8px", fontWeight: "700",
            }}>Get VIP</Link>
          </div>

          <div style={{
            background: "linear-gradient(180deg, #783ff5, #1c69e3)", borderRadius: "12px",
            padding: "28px", textAlign: "center", color: "#fff",
          }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>VVIP</h3>
            <p style={{ fontSize: "32px", fontWeight: "800", marginBottom: "16px" }}>UGX 150,000</p>
            <ul style={{ listStyle: "none", marginBottom: "24px", fontSize: "14px" }}>
              <li style={{ padding: "6px 0" }}>✅ Everything in VIP</li>
              <li style={{ padding: "6px 0" }}>✅ Full AI (TP1, TP2, TP3)</li>
              <li style={{ padding: "6px 0" }}>✅ Priority Support</li>
            </ul>
            <Link href="/register" style={{
              textDecoration: "none", display: "block", background: "#fff",
              color: "#783ff5", padding: "12px", borderRadius: "8px", fontWeight: "700",
            }}>Get VVIP</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "30px 20px", background: isDark ? "#1e293b" : "#f9fafb",
        borderTop: "1px solid #e5e7eb", textAlign: "center", color: "#6b7280",
      }}>
        <p>© 2026 TradeVault. All rights reserved.</p>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}