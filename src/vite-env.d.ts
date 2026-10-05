/// <reference types="vite/client" />

// Injected by vite.config.ts at build time. Vite's `define` only substitutes in
// the production bundle, so dev reads it as missing — every use must be guarded
// with `typeof` rather than touching the bare identifier.
declare const __BUILD_ID__: string | undefined;

declare module '*?raw' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_ADMIN_USERNAME?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_ADMIN_EMAIL?: string;
}
