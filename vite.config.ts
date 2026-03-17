import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5174,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  assetsInclude: ["**/*.ttf", "**/*.woff", "**/*.woff2"],
  build: {
    target: ["es2021", "chrome100"],
    minify: "esbuild",
    sourcemap: false,
    outDir: "dist",
  },
});
