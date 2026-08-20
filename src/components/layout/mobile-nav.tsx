"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Home", href: "/dashboard", icon: "📊" },
  { name: "Calculator", href: "/calculator", icon: "🧮" },
  { name: "Journal", href: "/journal", icon: "📓" },
  { name: "AI", href: "/ai-analysis", icon: "🤖" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "#fff",
        borderTop: "1px solid #e5e7eb",
        display: "none",
        justifyContent: "space-around",
        padding: "8px 0",
      }}
      className="mobile-nav-only"
    >
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.name}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              textDecoration: "none",
              color: isActive ? "#1c69e3" : "#6b7280",
              fontSize: "10px",
              fontWeight: isActive ? "700" : "500",
            }}
          >
            <span style={{ fontSize: "20px" }}>{item.icon}</span>
            {item.name}
          </Link>
        );
      })}

      <style>{`
        .mobile-nav-only {
          display: none !important;
        }
        @media (max-width: 768px) {
          .mobile-nav-only {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
}