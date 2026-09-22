import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { normalizeLegacyUrl, startRouter } from "./router";

// Clean URLs: rewrite legacy address-bar forms before the first render —
// /#/p/about (old hash link) → /about, /p/about → /about, /index.html → /.
// The .htaccess serves the same rewrites as 301s for requests that reach
// the server; hash fragments never reach the server, so this client-side
// step is what rewrites the old /#/… links (canonical tags always point
// at the clean URL).
normalizeLegacyUrl();
startRouter();

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root.hasAttribute('data-prerender') && document.documentElement.hasAttribute('data-prerender-home')) {
  hydrateRoot(root, app);
} else {
  // Do not display default homepage content on deep links or over a saved CMS.
  root.replaceChildren();
  createRoot(root).render(app);
}
root.removeAttribute('data-prerender');
