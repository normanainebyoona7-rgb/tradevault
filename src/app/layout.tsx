import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./responsive.css";
import "./animations.css";

export const metadata: Metadata = {
  title: "TradeVault - Forex Trade Journal & Calculator",
  description: "Track trades, analyze performance, and calculate position sizes with AI signals.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}