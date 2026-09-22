import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
