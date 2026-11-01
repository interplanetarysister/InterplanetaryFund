import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

// Reusable error + retry card for failed data fetches. Mount inside a page
// when its async load rejects, with an onRetry that clears the error and
// re-triggers the fetch.
export default function PageError({ message, onRetry }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="font-display text-xl text-stone-900 mb-1">Couldn't load this</h2>
      <p className="text-sm text-stone-500 mb-5">
        {message || "We couldn't load this right now. Please try again."}
      </p>
      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 h-10 min-h-[44px] text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        )}
        <Link
          to="/"
          className="inline-flex items-center rounded-xl border border-stone-200 px-4 h-10 min-h-[44px] text-sm font-medium text-stone-600"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}