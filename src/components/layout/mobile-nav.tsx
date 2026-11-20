"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calculator,
  LayoutDashboard,
  Settings,
  Sparkles,
} from "lucide-react";

const navigation = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calculator", href: "/calculator", icon: Calculator },
  { name: "Journal", href: "/journal", icon: BookOpen },
  { name: "AI", href: "/ai-analysis", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-8 w-12 items-center justify-center rounded-lg transition-colors ${
                  isActive ? "bg-primary/10" : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
