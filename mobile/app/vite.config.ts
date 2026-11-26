import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3003,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3002",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../www",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
});
