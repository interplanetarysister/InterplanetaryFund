import { useEffect, useRef, useState } from "react";
import { Globe2, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { US_CITY_CENTERS, selectUSCity } from "@/lib/usCityCenters.mjs";
import { authClient } from "@/api/auth";
import { lookupCampaignCity } from "@/api/cityGeocode";

/**
 * Explicit, approximate Atlas opt-in. Raw GPS coordinates are rounded in memory
 * to a 0.1° grid before they touch React state or the campaign API.
 * No permission is requested until the organizer selects the button.
 */
export default function CampaignLocationFields({ form, change, disabled = false }) {
  const [message, setMessage] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const revision = useRef(0);
  const controller = useRef(null);
  const mounted = useRef(true);
  const enabled = form?.map_opt_in === true;
  const editable = useRef(false);
  editable.current = enabled && !disabled;
  function cancelLookup() {
    ++revision.current;
    controller.current?.abort();
    setSearching(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++revision.current; controller.current?.abort(); };
  }, []);
  useEffect(() => { if (!enabled || disabled) cancelLookup(); }, [enabled, disabled]);
  async function searchCity() {
    if (!editable.current || searching) return;
    cancelLookup();
    const ticket = revision.current;
    const active = () => mounted.current && editable.current && ticket === revision.current;
    controller.current = new AbortController();
    setSearching(true);setMessage("Finding a broad city-centre location…");
    try {
      const city = await lookupCampaignCity(authClient(), cityQuery, { signal: controller.current.signal });
      if (!active()) return;
      change("public_location_label", city.display);
      change("map_latitude", String(city.lat));
      change("map_longitude", String(city.lng));
      setMessage("Broad city-centre point selected. Verify the city before saving. Nothing has been saved or published by this lookup.");
    } catch (cause) {
      if (active() && cause?.name !== "AbortError") {
        const safeMessage = typeof cause?.message === "string" &&
          /^(Enter a city|Sign in with|Your account changed|City search |City not found|The city location)/.test(cause.message)
          ? cause.message : "City search is unavailable. Choose a broad city preset instead.";
        setMessage(safeMessage);
      }
    } finally { if (active()) setSearching(false); }
  }
  function toggle(next) {
    cancelLookup();
    change("map_opt_in", next);
    if (!next) {
      change("public_location_label", "");
      change("map_latitude", "");
      change("map_longitude", "");
    }
    setMessage(next
      ? "Atlas placement is optional. Add only a broad public city/region, never a private address."
      : "Public map location disabled. Coordinates will not be saved.");
  }
  function approximateDevice() {
    cancelLookup();
    const ticket = revision.current;
    if (!navigator.geolocation) {
      setMessage("Device location is unavailable. You can enter an approximate city-centre latitude and longitude manually.");
      return;
    }
    setMessage("Requesting browser permission. Nothing is published until you save the campaign.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mounted.current || !editable.current || ticket !== revision.current) return;
        const lat = Math.round(coords.latitude * 10) / 10;
        const lng = Math.round(coords.longitude * 10) / 10;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setMessage("The device did not return usable coordinates.");
          return;
        }
        // Never retain the raw device position or forward it to a service.
        change("map_latitude", String(lat));
        change("map_longitude", String(lng));
        setMessage("Approximate coordinates selected (about 5–11 km resolution). Check the city/region name before saving.");
      },
      () => { if (mounted.current && editable.current && ticket === revision.current) setMessage("Location permission was denied or unavailable. Search for a city, choose a preset, or turn off Atlas visibility."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }
  return (
    <fieldset id="campaign-atlas-location" tabIndex={-1} className="space-y-4 rounded-xl border border-cyan-400/30 bg-cyan-950/5 p-4 scroll-mt-24 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Public campaign Atlas location" disabled={disabled}>
      <legend className="flex items-center gap-2 font-semibold"><Globe2 className="h-4 w-4" /> Public Atlas map location (optional)</legend>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={enabled} onChange={e => toggle(e.target.checked)} />
        <span>Show my campaign's <strong>approximate city or region</strong> as a public marker on the Atlas globe. Never use a home address or precise device location.</span>
      </label>
      {enabled && <>
        <section className="space-y-3 rounded-xl border border-border p-3" aria-label="Find a broad city location">
          <label className="block text-sm font-medium">Find a city or town
            <input type="text" maxLength={80} value={cityQuery} autoComplete="off"
              onChange={event => { cancelLookup(); setCityQuery(event.target.value); setMessage(""); }}
              placeholder="e.g. Paris, France" className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
          </label>
          <button type="button" disabled={searching || cityQuery.trim().length < 2} onClick={searchCity}
            className="min-h-11 rounded-xl border border-cyan-500/50 px-4 text-sm font-semibold disabled:opacity-50">
            {searching ? "Finding city…" : "Find city centre"}
          </button>
          <p className="text-xs text-muted-foreground">Confirmed email sign-in is required for online search. Enter city names only, never a street address or postal code. Lookup does not save or publish a campaign.</p>
          <p className="text-xs text-muted-foreground">City search data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>. Existing U.S. presets work without online lookup.</p>
        </section>
        <label className="block text-sm font-medium">Quick place: choose a broad U.S. city area
          <select value="" onChange={event=>{
            cancelLookup();
            const city=selectUSCity(event.target.value);
            if(!city) return;
            change("public_location_label",city.label);
            change("map_latitude",String(city.lat));
            change("map_longitude",String(city.lng));
            setMessage("Broad "+city.label+" city-centre point selected. Verify this is the actual region of your campaign. It will be published only when you save with Atlas sharing enabled.");
          }} className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3">
            <option value="">Choose a city area (optional)</option>
            {US_CITY_CENTERS.map(city=><option key={city.id} value={city.id}>{city.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">This is an organizer-selected approximate city-centre marker, not a detected location. Use the fields below for other regions; never add an exact address.</p>
        <label className="block text-sm font-medium">Public city or region label
          <input type="text" maxLength={80} value={form.public_location_label || ""}
            onChange={e => { cancelLookup(); change("public_location_label",e.target.value); }}
            placeholder="e.g. Seattle area, Washington"
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Approximate latitude
            <input type="number" inputMode="decimal" step="0.1" min="-90" max="90"
              value={form.map_latitude ?? ""} onChange={e => { cancelLookup(); change("map_latitude", e.target.value); }}
              placeholder="47.6" className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
          </label>
          <label className="block text-sm font-medium">Approximate longitude
            <input type="number" inputMode="decimal" step="0.1" min="-180" max="180"
              value={form.map_longitude ?? ""} onChange={e => { cancelLookup(); change("map_longitude",e.target.value); }}
              placeholder="-122.3" className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
          </label>
        </div>
        <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500/50 px-4 py-2 text-sm font-semibold"
          onClick={approximateDevice}><LocateFixed className="h-4 w-4" /> Use broad device area (permission required)</button>
        <p className="flex gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /> For a cause in a different city, enter that city's approximate coordinates instead. Only one decimal place can be stored.</p>
      </>}
      <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" /> Opted-out campaigns have no coordinates saved or shared. Opting in publishes the label and broad coordinates for active campaigns.</p>
      {message && <p role="status" className="text-sm text-cyan-700 dark:text-cyan-200">{message}</p>}
    </fieldset>
  );
}
