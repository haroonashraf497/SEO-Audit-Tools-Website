import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { normalizeLegacyUrl, startRouter } from "./router";
import { RouteBoundary } from "./components/ErrorBoundary";
import { prefetchPath, startIntentPrefetch } from "./utils/prefetch";

// Clean URLs: rewrite legacy address-bar forms before the first render —
// /#/p/about (old hash link) → /about, /p/about → /about, /index.html → /.
// The .htaccess serves the same rewrites as 301s for requests that reach
// the server; hash fragments never reach the server, so this client-side
// step is what rewrites the old /#/… links (canonical tags always point
// at the clean URL).
normalizeLegacyUrl();
startRouter();

// Warm route chunks on hover/focus/touch so navigating to a tool or blog post
// renders immediately instead of showing an empty body while the chunk loads.
startIntentPrefetch();

// Deep links (any route other than the homepage) boot from here.
const deepLinkPath = window.location.pathname;

/**
 * Every deep link that is not the homepage waits for its route chunk before the
 * first React commit — the same gate in-app navigation uses (see the route
 * subscription in App). The critical header shell is already on screen from the
 * raw HTML, so the visitor never stares at an empty page, and the page then
 * appears complete in a single commit: nothing is replaced afterwards, no
 * footer or sidebar jumps out, and no loading state is ever shown.
 *
 * A 3s ceiling keeps a slow network from stranding the visit; after that the
 * route renders and the error boundary is in charge of real failures.
 */
const deepLinkReady: Promise<unknown> = (deepLinkPath === '/' || deepLinkPath === '')
  ? Promise.resolve()
  : Promise.race([
      prefetchPath(deepLinkPath).catch(() => { /* the boundary reports real failures */ }),
      new Promise(resolve => setTimeout(resolve, 3_000)),
    ]);

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
  // Homepage: hydrate immediately. Its markup is already on screen (painted
  // from the HTML), so waiting for anything here would only add latency.
  hydrateRoot(root, app);
  root.removeAttribute('data-prerender');
} else {
  // Deep link / saved CMS: the markup in #root is only a seed, and a tool page
  // additionally needs its own component chunk. Wait for that chunk BEFORE the
  // first render (the critical header shell is already painted from the raw
  // HTML, so the visitor sees the site chrome immediately), then render the
  // page in a single commit. Nothing is ever replaced on screen afterwards, so
  // the deep link cannot shift — no reserve, no second pass, no loading state.
  root.replaceChildren();
  deepLinkReady.then(() => {
    createRoot(root).render(app);
    root.removeAttribute('data-prerender');
  });
}
