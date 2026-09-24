import React, { useEffect, useState } from 'react';
import { RouteRetryContext, useRouteRetry, ChunkLoadError, type RouteRetry } from '../utils/lazyRetry';

/**
 * The site renders routes from lazily fetched chunks. Before this, a chunk that
 * failed to arrive — or a component that threw while rendering — took the whole
 * page down: the visitor waited forever, or was left with a blank white
 * document. These two pieces make both outcomes recoverable.
 *
 *  - `RouteBoundary` catches anything thrown below it and replaces the subtree
 *    with an actionable message. "Try again" clears the error and bumps the
 *    retry token, which makes every `lazyRoute` child re-issue its import.
 *  - `LoadingFallback` is the Suspense fallback. It renders **nothing at all**
 *    while a chunk is on its way — the header is already on screen straight
 *    from the HTML, so a route transition needs no message. Only if the chunk
 *    is still missing after `timeoutMs` does it stop waiting silently and offer
 *    the same two recovery actions.
 */

/** How long the fallback waits before declaring the load stalled. */
export const LOAD_TIMEOUT_MS = 12_000;

interface PanelAction { label: string; onClick: () => void }

const Panel: React.FC<{ title: string; detail: string; actions: PanelAction[] }> = ({ title, detail, actions }) => (
  <div role="alert" className="mx-auto my-16 max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-600">{detail}</p>
    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-lg hover:shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      ))}
    </div>
  </div>
);

const reload = () => { window.location.reload(); };

/**
 * Suspense fallback with a hard deadline — and no loading message.
 *
 * Page and route transitions pass no `label`, so nothing readable is shown:
 * the header, logo and navigation are already on screen from the HTML shell,
 * and the visitor never sees "Loading page…" or any other waiting notice.
 *
 * The fallback is not `null`, though. While a route chunk downloads it renders
 * an *invisible* spacer the height of the viewport minus the header, so the
 * content area keeps its space and the footer stays pinned to the bottom of
 * the screen instead of collapsing up against the navigation. When the chunk
 * arrives the real content replaces the spacer and the layout is unchanged.
 *
 * A caller that genuinely needs to explain a long one-off download (the PDF
 * engine chunk in tools/Tools.tsx) still passes its own `label`, and that
 * behaviour is untouched.
 *
 * Either way, once `timeoutMs` has elapsed the fallback stops waiting silently
 * and offers recovery instead of leaving the visitor with nothing.
 */
export const LoadingFallback: React.FC<{ label?: React.ReactNode; timeoutMs?: number }> = ({
  label,
  timeoutMs = LOAD_TIMEOUT_MS,
}) => {
  const { token, retry } = useRouteRetry();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    setStalled(false);
    const id = window.setTimeout(() => setStalled(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [token, timeoutMs]);

  if (!stalled) {
    if (label) {
      return <div role="status" className="py-16 text-center text-slate-600">{label}</div>;
    }
    // Silent, but not empty: reserve the content area's height so the footer
    // does not jump up against the header while the route chunk downloads.
    // No text, no spinner, invisible to assistive technology.
    return <div aria-hidden="true" className="min-h-[calc(100vh-4rem)]" />;
  }
  return (
    <Panel
      title="This page is taking too long to load"
      detail="The connection stalled before the page finished downloading. Check your connection, then try again."
      actions={[{ label: 'Try again', onClick: retry }, { label: 'Reload page', onClick: reload }]}
    />
  );
};

interface RouteBoundaryProps {
  /** Human-readable name for the subtree, used in the console report. */
  label: string;
  children: React.ReactNode;
}

interface RouteBoundaryState {
  error: Error | null;
  token: number;
}

/** Catches render/import failures below it and offers a working way out. */
export class RouteBoundary extends React.Component<RouteBoundaryProps, RouteBoundaryState> {
  override state: RouteBoundaryState = { error: null, token: 0 };

  static getDerivedStateFromError(error: Error): Partial<RouteBoundaryState> {
    return { error };
  }

  /**
   * index.html paints a static shell (logo, brand, navigation and the loading
   * notice) so the header is on screen before any JavaScript runs. This
   * boundary wraps the whole app in main.tsx, so its mount is the moment React
   * has committed its own, identical header to the DOM.
   *
   * `componentDidMount` runs in the commit phase — after the DOM mutations and
   * before the browser paints — so the shell disappears in exactly the frame
   * the real header appears: no flash, no gap above the content, no layout
   * shift. It also runs when the boundary is already showing the error panel,
   * so a page that cannot render never keeps claiming it is still loading.
   * Route boundaries keyed by route remount on navigation; the lookup simply
   * finds nothing then.
   */
  override componentDidMount() {
    document.getElementById('app-shell')?.remove();
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the real cause in the console for support; the visitor sees the panel.
    console.error(`[RouteBoundary] ${this.props.label} failed to render`, error, info.componentStack);
  }

  private readonly retry = () => {
    this.setState((prev) => ({ error: null, token: prev.token + 1 }));
  };

  override render() {
    const { error, token } = this.state;
    const value: RouteRetry = { token, retry: this.retry };
    return (
      <RouteRetryContext.Provider value={value}>
        {error
          ? (
            <Panel
              title="Something went wrong on this page"
              detail={error instanceof ChunkLoadError
                ? 'Part of the page could not be downloaded. Your connection may have dropped, or the site was updated while the page was open.'
                : 'The page hit an unexpected error while rendering. Trying again usually clears it.'}
              actions={[{ label: 'Try again', onClick: this.retry }, { label: 'Reload page', onClick: reload }]}
            />
          )
          : this.props.children}
      </RouteRetryContext.Provider>
    );
  }
}
