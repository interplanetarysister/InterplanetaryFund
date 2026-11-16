import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import { ifundApiFetch } from "@/lib/nativeApi";
import { createSpecialistSession } from "@/lib/specialistSession";

const initial = { phase: "loading", workspace: null, busy: false, error: "", notice: "", uncertain: false };
export function useSpecialistService(agent, ownerId) {
  const [state, setState] = useState(initial);
  const scope = useRef(null), working = useRef(false), pending = useRef(null);
  const load = useCallback(async api => {
    if (agent === "strategy" || agent === "growth") {
      const subscription = await api("subscription");
      if (subscription.active !== true || !(Number(subscription.level) >= 1))
        return { campaigns: [], recommendations: [], access_available: false };
    }
    return { ...await api("workspace"), access_available: true };
  }, [agent]);
  useEffect(() => {
    let live = true;
    setState(initial); pending.current = null; working.current = false;
    let session;
    try {
      session = createSpecialistSession({ client: authClient(), ownerId, agent, fetcher: ifundApiFetch,
        onInvalidate: () => {
          pending.current = null; working.current = false;
          if (live) setState({ ...initial, phase: "changed", error: "Your account changed. Reopen this workspace to verify access." });
        } });
      scope.current = session;
      session.run(load, workspace => setState({ ...initial, phase: "ready", workspace }))
        .catch(error => { if (live && session.active) session.publish(() => setState({ ...initial, phase: "error", error: error.message })); });
    } catch (error) { setState({ ...initial, phase: "error", error: error.message }); }
    return () => { live = false; session?.dispose(); if (scope.current === session) scope.current = null; };
  }, [agent, ownerId, load]);
  const reload = useCallback(async (consume = () => {}) => {
    const session = scope.current;
    if (!session?.active || working.current) return;
    working.current = true;
    session.publish(() => setState(s => ({ ...s, busy: true, error: "" })));
    try {
      await session.run(load, workspace => {
        setState(s => ({ ...s, phase: "ready", workspace, error: "" }));
        if (!pending.current && typeof consume === "function") consume();
      });
      // A workspace read cannot prove an interrupted mutation did not commit.
      // Preserve its exact operation ID and retry lock until a receipt arrives.
    } catch (error) { if (session.active) session.publish(() => setState(s => ({ ...s, error: error.message }))); }
    finally { working.current = false; if (session.active) session.publish(() => setState(s => ({ ...s, busy: false }))); }
  }, [load]);
  const mutate = useCallback(async (action, body, consume = () => {}) => {
    const session = scope.current;
    if (!session?.active || working.current) return;
    if (pending.current && (pending.current.action !== action || JSON.stringify(pending.current.body) !== JSON.stringify(body))) return;
    // Snapshot before dispatch: uncertain retries may never use a changed form.
    const exact = pending.current || { action, body: JSON.parse(JSON.stringify(body)), consume };
    pending.current = exact; working.current = true;
    session.publish(() => setState(s => ({ ...s, busy: true, error: "", notice: "" })));
    try {
      await session.run(async api => {
        const receipt = await api(exact.action, exact.body);
        return { receipt, workspace: await load(api) };
      }, ({ receipt, workspace }) => {
        pending.current = null;
        setState({ phase: "ready", busy: false, workspace, error: "", notice: "Saved status reloaded from your account.", uncertain: false });
        exact.consume(receipt);
      });
    } catch (error) {
      if (session.active) session.publish(() => {
        const uncertain = error.code !== "new_request_required" && (!error.status || error.status >= 500);
        if (!uncertain) pending.current = null;
        setState(s => ({ ...s, error: error.message, uncertain }));
      });
    } finally { working.current = false; if (session.active) session.publish(() => setState(s => ({ ...s, busy: false }))); }
  }, [load]);
  const inspect = useCallback(async (action, body, consume) => {
    const session = scope.current;
    if (!session?.active || working.current || pending.current) return;
    working.current = true;
    session.publish(() => setState(s => ({ ...s, busy: true, error: "" })));
    try { await session.run(api => api(action, body), consume); }
    catch (error) { if (session.active) session.publish(() => setState(s => ({ ...s, error: error.message }))); }
    finally { working.current = false; if (session.active) session.publish(() => setState(s => ({ ...s, busy: false }))); }
  }, []);
  const retry = () => { const exact = pending.current; if (exact) return mutate(exact.action, exact.body, exact.consume); };
  return { ...state, locked: state.busy || state.uncertain || state.phase !== "ready", reload, mutate, inspect, retry };
}
