import { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import {
  loadCommunicationPreferences,
  saveCommunicationPreferences,
} from "@/lib/communicationPreferences";
export default function CommunicationPreferences() {
  const [snapshot, setSnapshot] = useState(null),
    [values, setValues] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const epoch = useRef(0),
    alive = useRef(true),
    working = useRef(false);
  useEffect(() => {
    alive.current = true;
    const read = ++epoch.current;
    loadCommunicationPreferences(authClient())
      .then((s) => {
        if (alive.current && read === epoch.current) {
          setSnapshot(s);
          setValues(s.values);
        }
      })
      .catch((e) => {
        if (alive.current && read === epoch.current) setError(e.message);
      });
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  async function reload() {
    if (working.current) return;
    working.current = true;
    const read = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const s = await loadCommunicationPreferences(authClient());
      if (alive.current && read === epoch.current) {
        setSnapshot(s);
        setValues(s.values);
      }
    } catch (e) {
      if (alive.current && read === epoch.current) setError(e.message);
    } finally {
      working.current = false;
      if (alive.current && read === epoch.current) setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (working.current) return;
    working.current = true;
    const read = ++epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const s = await saveCommunicationPreferences(
        authClient(),
        snapshot,
        values,
      );
      if (alive.current && read === epoch.current) {
        setSnapshot(s);
        setValues(s.values);
        setNotice("Your supporter update preferences are saved.");
      }
    } catch (e) {
      if (alive.current && read === epoch.current) setError(e.message);
    } finally {
      working.current = false;
      if (alive.current && read === epoch.current) setBusy(false);
    }
  }
  return (
    <section
      aria-label="Supporter update preferences"
      className="space-y-3 rounded-xl border p-5"
    >
      <h2 className="text-xl font-semibold">Supporter updates</h2>
      <p className="text-sm text-muted-foreground">
        Choose how campaigns you support may send updates. These preferences
        start enabled. You can turn them off without an AI plan.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {values && (
        <form onSubmit={save} className="space-y-3">
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              disabled={busy}
              checked={values.in_app_updates}
              onChange={(e) =>
                setValues((v) => ({ ...v, in_app_updates: e.target.checked }))
              }
            />
            Receive campaign updates inside IFund
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              disabled={busy}
              checked={values.email_updates}
              onChange={(e) =>
                setValues((v) => ({ ...v, email_updates: e.target.checked }))
              }
            />
            Allow email campaign updates when email delivery is available
          </label>
          <button
            disabled={busy}
            className="min-h-11 rounded-lg border px-4 py-2"
          >
            Save update preferences
          </button>
        </form>
      )}
      <button className="min-h-11 underline" disabled={busy} onClick={reload}>
        Reload update preferences
      </button>
    </section>
  );
}
