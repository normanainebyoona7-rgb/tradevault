"use client";

import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        background: theme === "dark" ? "#334155" : "#f9fafb",
        color: theme === "dark" ? "#f1f5f9" : "#111827",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        transition: "all 0.3s ease",
      }}
    >
      <span style={{ fontSize: "18px" }}>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}