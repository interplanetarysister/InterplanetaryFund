import React, { useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SocialButtons from "@/components/auth/SocialButtons";
import { safeReturnTo } from "@/lib/authReturnTo";
import { runtimeContract } from "@/lib/runtimeContract";
import { appParams } from "@/lib/app-params";
import { safeAuthErrorMessage, safeLoginFailureByStatus } from "@/lib/safe-auth-error";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Same-origin IFund authentication avoids stale SDK Authorization
      // headers and Base44 SDK's automatic logout redirect on 401 responses.
      // Never transmit credentials to another host or third-party connector.
      const appId = runtimeContract.appId || appParams.appId;
      if (!appId) throw new Error("IFund app ID unavailable");
      const path = "/api/apps/" + encodeURIComponent(appId) + "/auth/login";
      let result;
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        // The bundled Android app runs from a local origin, not the site origin.
        // Use native HTTPS only for the canonical Base44 authentication endpoint.
        const response = await CapacitorHttp.post({
          url: "https://interplanetaryfund.base44.app" + path,
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          data: { email: email.trim(), password },
        });
        if (response.status < 200 || response.status >= 300) {
          setError(safeLoginFailureByStatus(response.status));
          return;
        }
        result = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      } else {
        const response = await fetch(path, {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        if (!response.ok) {
          setError(safeLoginFailureByStatus(response.status));
          return;
        }
        result = await response.json().catch(() => ({}));
      }
      if (typeof result.access_token !== "string" || !result.access_token) {
        setError(safeAuthErrorMessage("login"));
        return;
      }
      base44.auth.setToken(result.access_token);
      window.location.assign(returnTo);
    } catch {
      setError(safeLoginFailureByStatus(null));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-medium hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <SocialButtons returnTo={returnTo} />

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use the email linked to your IFund account. If you registered with Google,
          Apple or Facebook, use that same sign-in option above instead.
        </p>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Forgot your password? <Link to="/forgot-password" className="underline">Reset it here</Link>.
      </p>
    </AuthLayout>
  );
}