// src/app/manifest.ts

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeVault - Forex Trade Journal",
    short_name: "TradeVault",
    description:
      "Track trades, analyze performance, and calculate position sizes.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1c69e3",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
