"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
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
      {/* Menu Toggle Button */}
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

      {/* Logo */}
      <Link
        href="/dashboard"
        style={{
          textDecoration: "none",
          color: "inherit",
          fontSize: "18px",
          fontWeight: "700",
        }}
      >
        TradeVault
      </Link>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Theme Toggle */}
      <ThemeToggle />
    </header>
  );
}
