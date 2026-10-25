import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { runtimeContract } from "@/lib/runtimeContract";
import { Button } from "@/components/ui/button";
import { Copy, KeyRound, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

// A browser-based diagnostic client for the SAME first-party device-code grant
// used by external IFund clients. Never put device secrets or access tokens in
// localStorage, browser URLs, React rendered text, logs, or user-visible output.
const BACKEND = "/api/apps/" + encodeURIComponent(runtimeContract.appId || appParams.appId) + "/functions/deviceAuthorization";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const STATUSES = {
  waiting: "Waiting for approval. Open the link below and approve the limited access request.",
  checking: "Checking the temporary authorization…",
  rejected: "Authorization denied. The browser test did not receive access.",
  expired: "The temporary code expired without approval. Start a new test.",
  verified: "The signed-in IFund account and read-only device connection were verified. Test access was revoked.",
  cleanup: "The read-only test succeeded, but automatic revocation could not be confirmed. Revoke the test device below before starting another test.",
  failed: "The test could not finish. Any unused approval code will expire automatically.",
};

async function invokeDevice(body, token) {
  const response = await fetch(BACKEND, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(token ? {"x-ifund-device-token":token} : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return {status:response.status,...payload};
}

function randomTestName() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = [...bytes].map(value => value.toString(16).padStart(2,"0")).join("");
  return "IFund browser check " + suffix;
}

export default function DevicePairingSelfTest({ onChanged }) {
  const secretRef = useRef("");
  const [test,setTest] = useState(null);
  const [status,setStatus] = useState("idle");
  const [busy,setBusy] = useState(false);
  const [verifying,setVerifying] = useState(false);
  const [error,setError] = useState("");

  const begin = async () => {
    if (busy || status === "waiting" || status === "checking") return;
    setBusy(true);
    setTest(null);
    setError("");
    secretRef.current = "";
    try {
      const label = randomTestName();
      const result = await invokeDevice({
        mode:"start",client_id:"ifund-device-v1",device_label:label,
        scopes:["identity:read"],
      });
      if (!result.device_code || !result.user_code || !result.verification_uri_complete) {
        throw new Error("Device code not issued");
      }
      secretRef.current = result.device_code;
      setTest({
        label,userCode:result.user_code,
        url:result.verification_uri_complete,
        expiresAt:Date.now() + Math.min(600,Number(result.expires_in)||600)*1000,
      });
      setStatus("waiting");
    } catch {
      setError("IFund could not issue a temporary device code. Please try again later.");
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!test || status !== "waiting") return;
    let active = true;
    let next;
    const check = async () => {
      if (!active) return;
      if (Date.now() >= test.expiresAt) {
        secretRef.current = "";
        setStatus("expired");
        return;
      }
      let delay = 5000;
      let receivedGrant = false;
      try {
        const reply = await invokeDevice({
          mode:"poll",grant_type:DEVICE_GRANT,device_code:secretRef.current,
        });
        if (!active) return;
        if (reply.access_token && reply.token_type === "Bearer") {
          receivedGrant = true;
          // Keep status=waiting until verification and revocation finish so
          // React does not clean up this active polling effect prematurely.
          setVerifying(true);
          const read = await invokeDevice({mode:"resource",action:"identity"},reply.access_token);
          if (!active) return;
          if (read.ok !== true || !read.identity?.id) {
            setError("Device authorization succeeded, but an authorized identity read failed.");
            setVerifying(false);
            setStatus("cleanup");
            return;
          }
          // Never persist access_token. Once the identity proof completes,
          // revoke the test grant by its unique device label and owner record.
          let revoked = false;
          try {
            const listing = await base44.functions.invoke("deviceAuthorization",{mode:"list"});
            const grants = (listing?.data||listing)?.devices;
            if (!Array.isArray(grants)) throw Error("Device grants unavailable");
            const matches = grants.filter(grant => grant.device_label === test.label && grant.state === "approved");
            if (matches.length !== 1) throw Error("Cannot determine unique test grant");
            const response = await base44.functions.invoke("deviceAuthorization",{
              mode:"revoke",authorization_id:matches[0].id,
            });
            revoked = (response?.data||response)?.revoked === true;
          } catch {
            // The user is told to revoke it manually; no token is retained.
          }
          if (active) {
            secretRef.current = "";
            setVerifying(false);
            setStatus(revoked ? "verified" : "cleanup");
            onChanged?.();
          }
          return;
        }
        if (reply.error === "slow_down") delay = 10000;
        else if (reply.error === "authorization_pending") delay = 5000;
        else if (reply.error === "access_denied") {secretRef.current = "";setStatus("rejected");return;}
        else if (reply.error === "expired_token") {secretRef.current = "";setStatus("expired");return;}
        else {setStatus("failed");setError("Authorization status could not be checked.");return;}
      } catch {
        if (active) {
          setVerifying(false);
          setStatus(receivedGrant ? "cleanup" : "failed");
          setError(receivedGrant
            ? "The test device was approved, but the verification could not finish. Revoke its access from your device list."
            : "Could not contact the device authorization service.");
        }
        return;
      }
      if (active) next = setTimeout(check,delay);
    };
    next = setTimeout(check,5000);
    return () => {
      active = false;
      clearTimeout(next);
    };
  },[test,status,onChanged]);

  const code = test?.userCode || "";
  return (
    <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5" aria-label="Device authorization connection test">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
        <KeyRound className="h-5 w-5 text-blue-700" /> Test IFund device authorization
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Verify the entire device approval process with your IFund account. This test requests your display name only, makes no payments, and attempts to revoke the test connection automatically.
      </p>
      {status !== "waiting" && status !== "checking" && (
        <Button type="button" onClick={begin} disabled={busy} className="mt-4 bg-blue-700 text-white hover:bg-blue-800">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          {busy ? "Creating test code…" : "Start connection test"}
        </Button>
      )}
      {test && (status === "waiting" || status === "checking") && (
        <div className="mt-4 rounded-xl border border-cyan-300 bg-white p-4">
          <p className="text-xs font-medium text-slate-600">Your temporary code</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <strong className="font-mono text-xl tracking-wider text-slate-950">{code}</strong>
            <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(code).catch(()=>{})}>
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
          </div>
          <a className="mt-4 block rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-800"
             href={test.url} target="_blank" rel="noopener noreferrer">
            Open IFund approval page
          </a>
          <p className="mt-2 text-xs text-slate-600">
            Approve in the other tab, then return here. The test checks automatically and the code expires after 10 minutes.
          </p>
        </div>
      )}
      {STATUSES[status] && (
        <p role="status" className="mt-4 flex items-start gap-2 text-sm text-slate-800">
          {status === "verified"
            ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
          {verifying ? "Verifying IFund's read-only access and revoking the test grant…" : STATUSES[status]}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
