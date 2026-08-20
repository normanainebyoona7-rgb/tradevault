"use client";

import { Header } from "@/components/layout/header";
import { useTheme } from "@/components/providers/theme-provider";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <div style={{
      minHeight: "100vh",
      background: theme === "dark" ? "#0f172a" : "#f9fafb",
      color: theme === "dark" ? "#f1f5f9" : "#111827",
      transition: "all 0.3s ease",
    }}>
      <Header />
      <main
        style={{
          paddingTop: "80px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "40px",
          minHeight: "100vh",
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
        }}
      >
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
          {children}
        </div>
      </main>
    </div>
  );
}