import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import "@/index.css";
import { installNativeApiTransport } from "@/lib/nativeApi";
import { installNativePublicLinks } from "@/lib/nativeLinks";

// Only bundled iOS/Android clients redirect their /api calls to canonical HTTPS.
// The website and non-IFund network requests remain untouched.
installNativeApiTransport();
installNativePublicLinks();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
