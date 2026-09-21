import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Fold clean paths (/tools, /p/contact, /blog/…) into the hash router so
// Apache, GitHub Pages and old PHP-style URLs all land on the SPA.
(() => {
  const { pathname, search, hash } = window.location;
  if (hash && hash !== "#" && hash !== "#/") return;
  const path = pathname.replace(/\/index\.html$/i, "").replace(/\/+$/, "") || "/";
  if (path === "/") return;
  if (/\.(xml|txt|jpg|jpeg|png|svg|ico|html|webmanifest|map)$/i.test(path)) return;
  window.history.replaceState(null, "", `/#${path}${search}`);
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
