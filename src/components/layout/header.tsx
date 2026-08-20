"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: "#ffffff",
      borderBottom: "1px solid #e5e7eb",
      height: "64px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    }}>
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
        <img
          src="/logo.png"
          alt="TradeVault"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            objectFit: "cover",
          }}
        />
        <span style={{ fontSize: "20px", fontWeight: "bold", color: "#111827" }}>
          Trade<span style={{ color: "#1c69e3" }}>Vault</span>
        </span>
      </Link>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        {!loading && !user && (
          <>
            <Link href="/login" style={{ textDecoration: "none", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>
              Login
            </Link>
            <Link href="/register" style={{
              textDecoration: "none", background: "#1c69e3", color: "#fff",
              padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600"
            }}>
              Get Started
            </Link>
          </>
        )}

        {user && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "none", border: "none", cursor: "pointer",
                padding: "8px"
              }}
            >
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, #1c69e3, #783ff5)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <span style={{ color: "#fff", fontWeight: "bold", fontSize: "16px" }}>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                {user.name}
              </span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>▼</span>
            </button>

            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 90 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div style={{
                  position: "absolute", right: 0, top: "48px",
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  minWidth: "220px", zIndex: 100, overflow: "hidden"
                }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <p style={{ fontWeight: "700", fontSize: "14px", color: "#111827" }}>{user.name}</p>
                    <p style={{ fontSize: "12px", color: "#6b7280" }}>{user.email}</p>
                  </div>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 16px", textDecoration: "none", color: "#111827", fontSize: "14px", borderBottom: "1px solid #f3f4f6" }}>
                    📊 Dashboard
                  </Link>
                  <Link href="/journal" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 16px", textDecoration: "none", color: "#111827", fontSize: "14px", borderBottom: "1px solid #f3f4f6" }}>
                    📓 Journal
                  </Link>
                  <Link href="/calculator" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 16px", textDecoration: "none", color: "#111827", fontSize: "14px", borderBottom: "1px solid #f3f4f6" }}>
                    🧮 Calculator
                  </Link>
                  <Link href="/settings" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 16px", textDecoration: "none", color: "#111827", fontSize: "14px", borderBottom: "1px solid #f3f4f6" }}>
                    ⚙️ Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "12px 16px", background: "none", border: "none",
                      color: "#dc2626", fontSize: "14px", fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    🚪 Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}