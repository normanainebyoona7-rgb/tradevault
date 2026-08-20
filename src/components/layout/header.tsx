"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Menu, User, LogOut, Home, Settings } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserName(data.user.name || data.user.email || "");
        }
      })
      .catch(() => {});

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "64px",
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "12px",
      }}
    >
      <button
        onClick={onMenuClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          background: "transparent",
          cursor: "pointer",
          color: "#6b7280",
          transition: "all 0.2s ease",
        }}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <Link
        href="/"
        style={{
          textDecoration: "none",
          color: "inherit",
          fontSize: "18px",
          fontWeight: "700",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <img 
          src="/logo.png" 
          alt="TradeVault" 
          style={{ width: "28px", height: "28px", borderRadius: "6px" }}
        />
        TradeVault
      </Link>

      <div style={{ flex: 1 }} />

      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          borderRadius: "8px",
          textDecoration: "none",
          color: "#6b7280",
          fontSize: "14px",
          fontWeight: "500",
          transition: "all 0.2s ease",
        }}
      >
        <Home size={16} />
        Home
      </Link>

      <ThemeToggle />

      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            cursor: "pointer",
            color: "#6b7280",
            transition: "all 0.2s ease",
          }}
          aria-label="User menu"
        >
          <User size={18} />
        </button>

        {userMenuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "48px",
              width: "200px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              zIndex: 60,
              padding: "8px",
            }}
          >
            {userName && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: "13px",
                  color: "#6b7280",
                  borderBottom: "1px solid #e5e7eb",
                  marginBottom: "4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userName}
              </div>
            )}

            <button
              onClick={() => {
                setUserMenuOpen(false);
                window.location.href = "/settings";
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#374151",
                fontSize: "14px",
              }}
            >
              <Settings size={16} />
              Settings
            </button>

            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
