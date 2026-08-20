"use client";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useTheme } from "@/components/providers/theme-provider";

export default function AuthLayout({
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
      <Sidebar />
      <main
        style={{
          paddingTop: "70px",
          paddingLeft: "260px",
          paddingRight: "20px",
          paddingBottom: "70px",
          minHeight: "100vh",
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
        }}
        className="auth-main"
      >
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
          {children}
        </div>
      </main>
      <MobileNav />

      <style jsx>{`
        @media (max-width: 768px) {
          .auth-main {
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 60px !important;
            padding-bottom: 80px !important;
          }
        }
      `}</style>
    </div>
  );
}