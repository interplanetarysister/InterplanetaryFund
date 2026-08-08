/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserLogin({ onLogin }: { onLogin: (userId: string, name: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shouldLogin, setShouldLogin] = useState(false);

  const loginQuery = useQuery(api.userAuth.login, email && mode === "login" ? { email } : "skip");
  const register = useMutation(api.userAuth.register);

  // Watch for login query result — fixes the race condition
  // where the query hadn't loaded when the user clicked Sign In
  useEffect(() => {
    if (shouldLogin && loginQuery !== undefined) {
      setShouldLogin(false);
      setLoading(false);
      if (loginQuery.success) {
        onLogin(loginQuery.userId || "", loginQuery.name || "");
      } else if (mode === "login") {
        setError("No account found with this email. Create one?");
        setMode("register");
      }
    }
  }, [shouldLogin, loginQuery, mode, onLogin]);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your name");
        return;
      }
      setLoading(true);
      try {
        const result = await register({ email, name });
        if (result.success) {
          onLogin(result.userId || "", result.name || "");
        } else {
          // Account exists — switch to login mode
          setMode("login");
          setError("Account already exists. Sign in with your email.");
          setShouldLogin(true);
        }
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      }
      setLoading(false);
    } else {
      // Login mode — trigger the query watcher
      if (loginQuery !== undefined && loginQuery.success) {
        onLogin(loginQuery.userId || "", loginQuery.name || "");
      } else if (loginQuery !== undefined && !loginQuery.success) {
        setError("No account found with this email. Create one?");
        setMode("register");
      } else {
        // Query is loading — set flag so useEffect handles it when ready
        setLoading(true);
        setShouldLogin(true);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ifaccent text-white font-bold text-2xl">
            IF
          </div>
          <h1 className="text-xl font-bold text-iftext">
            {mode === "login" ? "Welcome Back, Pilot" : "Join the Mission"}
          </h1>
          <p className="text-xs text-ifmuted">
            {mode === "login" ? "Sign in to manage your campaigns" : "Create an account to launch your campaign"}
          </p>
        </div>

        {error && (
          <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3">
            <p className="text-xs text-ifred">{error}</p>
          </div>
        )}

        {mode === "register" && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        )}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="input-field"
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="w-full text-xs text-ifmuted text-center"
        >
          {mode === "login" ? "New pilot? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
