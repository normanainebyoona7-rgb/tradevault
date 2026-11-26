import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tradevault.app",
  appName: "TradeVault",
  webDir: "www",
  server: {
    url: process.env.TRADEVAULT_APP_URL || "https://tradevault-tradevault.vercel.app",
    cleartext: false,
    allowNavigation: ["*.vercel.app", "vercel.com"],
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#07111f",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#07111f",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#07111f",
    },
  },
};

export default config;
