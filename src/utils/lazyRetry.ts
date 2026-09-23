import React, { createContext, useContext } from 'react';

/**
 * Route chunks are fetched from /assets on demand. Two things can go wrong on a
 * real network: the request fails (offline, flaky proxy, a 404 for a chunk that
 * a new deploy replaced) or it never settles at all. Both used to leave the
 * visitor staring at the "Loading page…" spinner forever, because a rejected
 * `React.lazy` import had no error boundary to land in and a stalled one simply
 * never resolves.
 *
 * This module makes the failure recoverable:
 *  - `importWithRetry` re-attempts a failed import a few times with backoff,
 *    which fixes the transient case with no user interaction;
 *  - `lazyRoute` hands every route to `React.lazy` through that retrying loader
 *    and rebuilds the lazy component whenever the enclosing `ErrorBoundary`
 *    bumps the retry token, so an explicit "Try again" starts a genuinely new
 *    import instead of replaying React's cached rejection;
 *  - a final failure surfaces as `ChunkLoadError`, which the boundary renders
 *    as a message with "Try again" / "Reload" instead of a blank page.
 */

/** Total import attempts for one chunk before the failure is surfaced. */
export const CHUNK_ATTEMPTS = 3;
/** Delay before attempt 2; each later attempt waits twice as long. */
export const CHUNK_RETRY_DELAY_MS = 200;

export interface RouteRetry {
  /** Increments on every explicit retry; consumers re-arm/re-fetch on change. */
  token: number;
  /** Ask the enclosing boundary to retry (clears its error and bumps `token`). */
  retry: () => void;
}

export const RouteRetryContext = createContext<RouteRetry>({ token: 0, retry: () => {} });

/** Use it inside a lazy route or a Suspense fallback to reach the boundary. */
export function useRouteRetry(): RouteRetry {
  return useContext(RouteRetryContext);
}

export class ChunkLoadError extends Error {
  readonly attempts: number;
  readonly reason: unknown;
  constructor(attempts: number, reason: unknown) {
    super(`Could not load this page after ${attempts} attempts.`);
    this.name = 'ChunkLoadError';
    this.attempts = attempts;
    this.reason = reason;
  }
}

// Bare setTimeout (not window.setTimeout) so this stays safe if it ever runs
// during the build-time prerender, where `window` is only a partial shim.
const wait = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** Resolve `loader()`, retrying transient failures; rejects with ChunkLoadError. */
export function importWithRetry<T>(loader: () => Promise<T>, attempts: number = CHUNK_ATTEMPTS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const attempt = (index: number) => {
      Promise.resolve()
        .then(loader)
        .then(resolve)
        .catch((reason: unknown) => {
          if (index + 1 < attempts) {
            void wait(CHUNK_RETRY_DELAY_MS * 2 ** index).then(() => attempt(index + 1));
          } else {
            reject(new ChunkLoadError(attempts, reason));
          }
        });
    };
    attempt(0);
  });
}

/**
 * Built lazy components, keyed by loader. A render that suspends is thrown away
 * and re-run by React, so building the lazy component inside render would hand
 * React a brand new (still pending) promise on every retry and the fallback
 * would never resolve — the exact infinite spinner this module exists to
 * remove. One lazy component per loader + retry token preserves React's cached
 * rejection, which is what lets a permanent failure reach the error boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLazy = React.LazyExoticComponent<React.ComponentType<any>>;
const lazyCache = new WeakMap<object, { token: number; lazy: AnyLazy }>();

/**
 * Drop-in replacement for `React.lazy` that survives a failed chunk fetch.
 * Bumping the retry token (the boundary's "Try again") builds a fresh lazy
 * component, which is the only way to make React issue the import again.
 */
export function lazyRoute<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>): T {
  const Route = (props: React.ComponentProps<T>) => {
    const { token } = useRouteRetry();
    let entry = lazyCache.get(loader);
    if (!entry || entry.token !== token) {
      entry = { token, lazy: React.lazy(() => importWithRetry(loader)) };
      lazyCache.set(loader, entry);
    }
    return React.createElement(entry.lazy as React.ComponentType<React.ComponentProps<T>>, props);
  };
  Route.displayName = 'LazyRoute';
  return Route as unknown as T;
}
