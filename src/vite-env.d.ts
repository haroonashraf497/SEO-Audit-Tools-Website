/// <reference types="vite/client" />

declare const __BUILD_ID__: string;

declare module '*?raw' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_ADMIN_USERNAME?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_ADMIN_EMAIL?: string;
}
