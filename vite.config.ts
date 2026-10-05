import { execSync } from "child_process";
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

/**
 * Build stamp, rendered in the admin header as "build <sha> · <UTC>". Its only
 * job is to make a stale deployment obvious at a glance — the number of times
 * this project has had "the change is missing" reported against a build that
 * predated the change is why it exists. The sha is HEAD when the bundle is
 * produced, suffixed with + if src/, public/ or this config had uncommitted
 * changes; without git (a downloaded zip, say) the timestamp alone is used.
 */
const buildStamp = (() => {
  const at = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  try {
    const sha = execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim();
    const dirty = execSync("git status --porcelain -- src public vite.config.ts", {
      cwd: __dirname,
    }).toString().trim().length > 0;
    return `${sha}${dirty ? "+" : ""} · ${at}`;
  } catch {
    return at;
  }
})();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Single-file build: every route module, all of the CMS/admin UI and the
    // stylesheet are inlined into dist/index.html, so the deployed app is one
    // document with no chunks to fetch. Opening any route is therefore
    // instant — there is no lazy network request and no loading placeholder.
    // `useRecommendedBuildConfig: false` keeps the public base path absolute
    // (`/favicon.svg`, `/og.jpg`, …); the defaults the plugin would otherwise
    // apply are set explicitly in `build` below.
    viteSingleFile({ useRecommendedBuildConfig: false, removeViteModuleLoader: true }),
    hostingFiles(),
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildStamp),
  },
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
    // One document, one stylesheet, one script — all inlined.
    cssCodeSplit: false,
    assetsInlineLimit: () => true,
    chunkSizeWarningLimit: 100_000_000,
    modulePreload: false,
    reportCompressedSize: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
});
