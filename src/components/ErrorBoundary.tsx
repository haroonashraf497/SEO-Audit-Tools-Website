import React from 'react';

/**
 * Render-error handling for a single-file, eagerly-loaded app.
 *
 * Every route is a static import inside dist/index.html, so there is no chunk
 * request that can fail, stall or resolve late — nothing on the site can show a
 * loading state, and `<Suspense>` is not used anywhere. What can still happen is
 * a component throwing while it renders, so this boundary stays as the last line
 * of defence: instead of a blank document the visitor gets a message and a
 * working way out.
 *
 * "Try again" clears the error and bumps the retry token; the token keys the
 * children, which remounts the failed subtree so a transient error is genuinely
 * retried rather than replayed from React's cached state.
 */

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

interface RouteBoundaryProps {
  /** Human-readable name for the subtree, used in the console report. */
  label: string;
  children: React.ReactNode;
}

interface RouteBoundaryState {
  error: Error | null;
  token: number;
}

/** Catches render failures below it and offers a working way out. */
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
    if (error) {
      return (
        <Panel
          title="Something went wrong on this page"
          detail="The page hit an unexpected error while rendering. Trying again usually clears it."
          actions={[{ label: 'Try again', onClick: this.retry }, { label: 'Reload page', onClick: reload }]}
        />
      );
    }
    // Keying the subtree on the retry token means "Try again" builds it fresh.
    return <React.Fragment key={token}>{this.props.children}</React.Fragment>;
  }
}
