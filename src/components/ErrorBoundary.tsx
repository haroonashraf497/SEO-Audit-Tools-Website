import React, { useEffect, useState } from 'react';
import { RouteRetryContext, useRouteRetry, ChunkLoadError, type RouteRetry } from '../utils/lazyRetry';

/**
 * The site renders routes from lazily fetched chunks. Before this, a chunk that
 * failed to arrive — or a component that threw while rendering — took the whole
 * page down: the spinner stayed on screen forever, or the visitor was left with
 * a blank white document. These two pieces make both outcomes recoverable.
 *
 *  - `RouteBoundary` catches anything thrown below it and replaces the subtree
 *    with an actionable message. "Try again" clears the error and bumps the
 *    retry token, which makes every `lazyRoute` child re-issue its import.
 *  - `LoadingFallback` is the Suspense fallback: a subtle spinner while the
 *    chunk is still plausibly on its way and, if it has not arrived after
 *    `LOAD_TIMEOUT_MS`, the same two actions instead of an endless spinner.
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
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-lg hover:shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      ))}
    </div>
  </div>
);

const reload = () => { window.location.reload(); };

/**
 * Suspense fallback with a hard deadline. The `role="status"` notice keeps the
 * same wording for crawlers, screen readers and the existing tests, but it is
 * no longer painted across the content area: a route change shows a small
 * spinner, and the text is left to assistive technology. A caller-supplied
 * label (the PDF engine notice) is a designed spinner + caption of its own, so
 * that one still renders exactly as before. If the chunk has not arrived after
 * `LOAD_TIMEOUT_MS` the fallback stops pretending and offers two actions.
 */
export const LoadingFallback: React.FC<{ label?: React.ReactNode; timeoutMs?: number }> = ({
  label = 'Loading page…',
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
    if (typeof label !== 'string') {
      return <div role="status" className="py-16 text-center text-slate-600">{label}</div>;
    }
    return (
      <div role="status" className="flex items-center justify-center gap-3 py-16">
        <span className="route-spinner" aria-hidden="true" />
        <span className="sr-text">{label}</span>
      </div>
    );
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
