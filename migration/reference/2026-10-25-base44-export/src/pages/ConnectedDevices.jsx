import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldOff, Smartphone } from "lucide-react";
import DevicePairingSelfTest from "@/components/devices/DevicePairingSelfTest";

const DESCRIPTIONS = {
  "identity:read": "IFund identity",
  "campaigns:read": "Campaign overview",
};

export default function ConnectedDevices() {
  const [devices,setDevices]=useState([]);
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const reload=useCallback(async()=>{
    setError("");setLoading(true);
    try {
      const result=await base44.functions.invoke("deviceAuthorization",{mode:"list"});
      const data=result?.data||result;
      if(data?.ok !== true || !Array.isArray(data.devices))throw Error("Invalid list response");
      setDevices(data.devices);
    } catch {
      setError("Could not load connected devices. Try again.");
    } finally {setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);

  const revoke=async(id)=>{
    if(busy)return;
    setBusy(id);setError("");setNotice("");
    try {
      const result=await base44.functions.invoke("deviceAuthorization",{mode:"revoke",authorization_id:id});
      if((result?.data||result)?.revoked !== true)throw Error("Not revoked");
      setDevices(rows=>rows.map(r=>r.id===id?{...r,state:"revoked"}:r));
      setNotice("Device access revoked.");
    } catch {
      setError("Could not revoke access. Please retry.");
    } finally{setBusy("");}
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-stone-900"><Smartphone className="h-7 w-7 text-blue-600" /> Connected devices</h1>
      <p className="mt-2 text-sm text-stone-600">
        IFund-owned devices and agents you approved using a temporary code. Device permissions do not include payments, withdrawals, publishing, or outside accounts.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/activate"><Button variant="outline">Enter a device code</Button></Link>
        <Button variant="outline" onClick={reload} disabled={loading}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>
      <DevicePairingSelfTest onChanged={reload} />
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
      {loading ? <p className="mt-6 text-slate-600">Loading your devices…</p> : devices.length===0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-600">No authorized devices yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {devices.map(device=>{
            const expired = Date.parse(device.grant_expires_at||"") <= Date.now();
            const active = device.state==="approved" && !expired;
            return (
              <div key={device.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-stone-900">{device.device_label}</h2>
                    <p className="mt-1 text-xs text-stone-600">
                      {active ? "Authorized" : device.state==="revoked" ? "Revoked" : expired ? "Expired" : device.state}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {(device.scopes||[]).map(scope=>DESCRIPTIONS[scope]||"Unknown permission").join(" · ")}
                    </p>
                    {device.grant_expires_at && <p className="mt-2 text-xs text-slate-500">Expires {new Date(device.grant_expires_at).toLocaleDateString()}</p>}
                  </div>
                  {active && (
                    <Button variant="outline" disabled={!!busy} onClick={()=>revoke(device.id)}
                      className="border-red-200 text-red-700 hover:bg-red-50">
                      <ShieldOff className="mr-1 h-4 w-4" /> {busy===device.id?"Revoking…":"Revoke access"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
