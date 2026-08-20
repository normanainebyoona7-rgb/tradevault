"use client";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useTheme } from "@/components/providers/theme-provider";
import { useState } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: theme === "dark" ? "#0f172a" : "#f9fafb",
      color: theme === "dark" ? "#f1f5f9" : "#111827",
      transition: "all 0.3s ease",
    }}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <main
        style={{
          paddingTop: "70px",
          paddingLeft: sidebarOpen ? "260px" : "20px",
          paddingRight: "20px",
          paddingBottom: "70px",
          minHeight: "100vh",
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          transition: "padding-left 0.3s ease-in-out",
        }}
        className="auth-main"
      >
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
          {children}
        </div>
      </main>
      <MobileNav />

      <style jsx>{+""+
        @media (max-width: 768px) {
          .auth-main {
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-top: 60px !important;
            padding-bottom: 80px !important;
          }
        }
      +""+}</style>
    </div>
  );
}
