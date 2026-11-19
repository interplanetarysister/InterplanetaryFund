import { isAssetLoadFailure } from "../lib/assetLoadRecovery.mjs";
import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

// Per-route error boundary. Wraps <Outlet/> in the Layout so a render crash
// in any page replaces only that page's content with a recovery card — the nav
// and chrome stay mounted. "Try again" resets the boundary; "Home" navigates.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Route render error:", error, info);
  }

  reset = () => {
    if (isAssetLoadFailure(this.state.error)) {
      // Failed lazy imports are cached by React.lazy. A boundary state reset
      // cannot recover the stale chunk; refresh only after explicit user action.
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <section role="alert" aria-labelledby="ifund-route-error-heading" className="mx-auto my-8 max-w-lg rounded-2xl border border-destructive/30 bg-card px-5 py-12 text-center text-foreground shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 id="ifund-route-error-heading" className="font-display mb-2 text-xl font-bold">This page could not finish loading</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            {isAssetLoadFailure(this.state.error)
              ? "A page update could not load. Refresh to fetch the current version, or return home."
              : "This part of the application could not load. Try again or return home."}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 h-10 min-h-[44px] text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" /> {isAssetLoadFailure(this.state.error) ? "Refresh page" : "Try again"}
            </button>
            <a
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground"
            >
              <Home className="w-4 h-4" /> Home
            </a>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Your saved work is not intentionally changed by this error screen. If retrying fails, visit the Help Center.</p>
          <a href="/help" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Visit Help Center</a>
        </section>
      );
    }
    return this.props.children;
  }
}