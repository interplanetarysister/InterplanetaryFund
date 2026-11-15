import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import MobileStoreApp from "./MobileStoreApp.jsx";
import NativeConnectivityBanner from "./components/native/NativeConnectivityBanner.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { installNativeApiTransport } from "./lib/nativeApi.js";
import { installNativePublicLinks } from "./lib/nativeLinks.js";

// Scoped native HTTP and app links must initialize before React mounts.
// The canonical website uses its separate main.jsx and App.jsx unchanged.
installNativeApiTransport();
installNativePublicLinks();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><NativeConnectivityBanner/><MobileStoreApp/></ErrorBoundary>
);
