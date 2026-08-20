"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { useState, useEffect } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Calculator", href: "/calculator", icon: "🧮" },
  { name: "Journal", href: "/journal", icon: "📓" },
  { name: "Charts", href: "/charts", icon: "📈" },
  { name: "Analytics", href: "/analytics", icon: "📉" },
  { name: "AI Analysis", href: "/ai-analysis", icon: "🤖" },
  { name: "Education", href: "/education", icon: "🧠" },
  { name: "News", href: "/news", icon: "📰" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      onClose();
    }
  }, [pathname, isMobile]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 39,
          }}
          onClick={onClose}
        />
      )}

      <aside
        style={{
          position: "fixed",
          left: isOpen ? 0 : "-240px",
          top: "64px",
          bottom: 0,
          width: "240px",
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          zIndex: 40,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          transition: "left 0.3s ease-in-out",
          boxShadow: isOpen ? "2px 0 8px rgba(0,0,0,0.1)" : "none",
        }}
        className="sidebar-desktop"
      >
        <nav style={{ flex: 1, padding: "16px 12px" }}>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "4px",
                  textDecoration: "none",
                  background: isActive ? "#dbeafe" : "transparent",
                  color: isActive ? "#1c69e3" : "#6b7280",
                  fontWeight: isActive ? "700" : "500",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div style={{ padding: "12px", borderTop: "1px solid #e5e7eb" }}>
          <ThemeToggle />
        </div>

        {/* Upgrade Card */}
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
          <Link
            href="/settings"
            onClick={isMobile ? onClose : undefined}
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px",
              background: "linear-gradient(135deg, #1c69e3, #783ff5)",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            Upgrade to Pro
          </Link>
        </div>
      </aside>
    </>
  );
}