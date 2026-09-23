import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { normalizeLegacyUrl, startRouter } from "./router";
import { RouteBoundary } from "./components/ErrorBoundary";

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
    {/* Last line of defence: a throw anywhere in the tree still leaves the
        visitor a recovery panel instead of a blank document. It renders no DOM
        of its own, so the prerendered homepage still hydrates cleanly. */}
    <RouteBoundary label="site shell">
      <App />
    </RouteBoundary>
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
