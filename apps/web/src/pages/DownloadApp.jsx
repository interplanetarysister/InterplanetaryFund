import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Smartphone, MonitorDown, ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

// Install the existing website as a browser-managed app. The site does not
// advertise an APK until a signed, public release URL has been verified.
export default function DownloadApp() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    setInstalled(isInstalled);
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("IFund has been installed.");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const requestInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome !== "accepted") setMessage("You can install IFund later from your browser menu.");
    } catch {
      setMessage("Use your browser menu to install IFund.");
    } finally {
      setInstallPrompt(null);
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-5 py-12 sm:py-20 text-foreground">
      <div className="flex justify-center mb-6"><BrandLogo size="lg" /></div>
      <h1 className="font-display text-center text-3xl sm:text-4xl font-bold">Download IFund</h1>
      <p className="mx-auto mt-4 max-w-lg text-center text-muted-foreground">
        Add Interplanetary Fund to your phone or computer to open it like an app. No app-store account is required.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Download className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold">Install the web app</h2>
        {installed ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">IFund is already installed on this device.</p>
        ) : installPrompt ? (
          <button type="button" onClick={requestInstall}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90">
            <Download className="h-5 w-5" /> Install IFund
          </button>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Open this page in Chrome, Edge, or Safari and follow the steps below to add IFund.
          </p>
        )}
        {message && <p className="mt-3 text-sm" role="status">{message}</p>}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-5">
          <Smartphone className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Phone or tablet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Android: open Chrome's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            On iPhone or iPad, use Safari's Share menu, then <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <div className="rounded-2xl border border-border p-5">
          <MonitorDown className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">Computer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            In Chrome or Edge, choose the install icon in the address bar or use the browser menu's install option.
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Android APK downloads are offered only when a signed public IFund release is available. This browser install does not download an APK.
      </p>
      <Link to="/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to homepage
      </Link>
    </section>
  );
}
