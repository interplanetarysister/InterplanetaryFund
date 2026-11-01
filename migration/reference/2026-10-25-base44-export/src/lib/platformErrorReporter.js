import { base44 } from "@/api/base44Client";
const recent = new Map();
export function reportFrontendError({source="app_request",kind="other",error,summary}={}) {
  const route=typeof window!=="undefined" ? window.location.pathname : "/unknown";
  const code=String(error?.name||"FrontendError").replace(/[^a-zA-Z0-9_. -]/g,"").slice(0,60);
  const key=[source,kind,route,code].join(":");
  if(Date.now()-(recent.get(key)||0)<60000)return;
  recent.set(key,Date.now());
  if(recent.size>100)recent.clear();
  const detail=String(summary||"Frontend action failed").slice(0,120);
  try {
    Promise.resolve(base44.functions.invoke("managePlatformIncidents",{
      mode:"report",source,kind,route,code,summary:detail
    })).catch(()=>{});
  } catch { /* Reporting errors must never become new application errors. */ }
}
export function installPlatformErrorReporting(){
  const onError=e=>reportFrontendError({
    source:"window_error",kind:e?.target&&e.target!==window?"resource":"script",
    error:e?.error,summary:"An application resource or script failed"
  });
  const onRejection=e=>reportFrontendError({
    source:"unhandled_rejection",kind:"promise",error:e?.reason,
    summary:"An unhandled application operation failed"
  });
  window.addEventListener("error",onError,true);
  window.addEventListener("unhandledrejection",onRejection);
  return ()=>{
    window.removeEventListener("error",onError,true);
    window.removeEventListener("unhandledrejection",onRejection);
  };
}
