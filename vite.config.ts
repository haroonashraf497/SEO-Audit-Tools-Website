import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { inlineCriticalCss } from "./scripts/inline-css";
import { routeChunkUrls } from "./scripts/route-chunks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Make sure Apache hosting files land in dist even if dotfiles are skipped. */
const hostingFiles = (): Plugin => ({
  name: "hosting-files",
  closeBundle() {
    const dist = path.resolve(__dirname, "dist");
    const htaccessSrc = path.resolve(__dirname, "public/.htaccess");
    if (fs.existsSync(htaccessSrc) && fs.existsSync(dist)) {
      fs.copyFileSync(htaccessSrc, path.join(dist, ".htaccess"));
    }
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCriticalCss(), routeChunkUrls(), hostingFiles()],
  server: {
    host: true,
    allowedHosts: [".e2b.app", ".arena.site"],
  },
  preview: {
    host: true,
    allowedHosts: [".e2b.app", ".arena.site"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    minify: "terser",
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
    // One stylesheet for the whole app; it is inlined into <head> so the
    // prerendered page never waits on a second render-blocking request.
    cssCodeSplit: false,
    // Route modules are real external chunks fetched by React.lazy on
    // demand. The entry and its static imports are preloaded; the polyfill
    // is unnecessary on the existing Tailwind 4 browser baseline.
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    sourcemap: false,
  },
  esbuild: {
    legalComments: "none",
  },
});
