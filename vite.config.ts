import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

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
  plugins: [react(), tailwindcss(), viteSingleFile(), hostingFiles()],
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
    cssCodeSplit: false,
    modulePreload: false,
    reportCompressedSize: false,
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
  esbuild: {
    legalComments: "none",
  },
});
