"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  Calculator,
  CandlestickChart,
  Crown,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  LogOut,
  Newspaper,
  Settings,
  Sparkles,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calculator", href: "/calculator", icon: Calculator },
  { name: "Journal", href: "/journal", icon: BookOpen },
  { name: "Charts", href: "/charts", icon: CandlestickChart },
  { name: "Analytics", href: "/analytics", icon: LineChart },
  { name: "AI Analysis", href: "/ai-analysis", icon: Sparkles },
  { name: "Education", href: "/education", icon: GraduationCap },
  { name: "News", href: "/news", icon: Newspaper },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-16 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-5">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground/80 group-hover:text-foreground"
                      }`}
                    />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-border p-3">
          <div className="rounded-xl bg-brand-gradient p-4 text-white shadow-glow">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Crown className="h-4 w-4" />
              Go Pro
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/85">
              Unlimited trades, AI analysis and priority support.
            </p>
            <Link
              href="/settings"
              className="mt-3 flex h-8 w-full items-center justify-center rounded-lg bg-white text-xs font-semibold text-primary-hover transition-colors hover:bg-emerald-50"
            >
              Upgrade
            </Link>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
