import { useSearchParams } from "react-router-dom";

// Drives an overlay's open state from a URL search param (e.g. ?donate=true).
// Opening pushes a history entry, so the Android system back button closes the
// overlay instead of unloading the route. Closing replaces that entry, so back
// never re-opens a dismissed overlay.
export default function useUrlDialog(param, value = "true") {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get(param);
  const open = value === null ? current !== null : current === value;

  const setOpen = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set(param, value === null ? "true" : value);
      setSearchParams(params);
    } else {
      params.delete(param);
      setSearchParams(params, { replace: true });
    }
  };

  return [open, setOpen];
}