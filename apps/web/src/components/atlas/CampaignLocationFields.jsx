import { useState } from "react";
import { Globe2, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { US_CITY_CENTERS, selectUSCity } from "@/lib/usCityCenters.mjs";

/**
 * Explicit, approximate Atlas opt-in. Raw GPS coordinates are rounded in memory
 * to a 0.1° grid before they touch React state or the campaign API.
 * No permission is requested until the organizer selects the button.
 */
export default function CampaignLocationFields({ form, change, disabled = false }) {
  const [message, setMessage] = useState("");
  const enabled = form?.map_opt_in === true;
  function toggle(next) {
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
    if (!navigator.geolocation) {
      setMessage("Device location is unavailable. You can enter an approximate city-centre latitude and longitude manually.");
      return;
    }
    setMessage("Requesting browser permission. Nothing is published until you save the campaign.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
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
      () => setMessage("Location permission was denied or unavailable. Enter an approximate city-centre point manually, or turn off Atlas visibility."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }
  return (
    <fieldset className="space-y-4 rounded-xl border border-cyan-400/30 bg-cyan-950/5 p-4" aria-label="Public campaign Atlas location" disabled={disabled}>
      <legend className="flex items-center gap-2 font-semibold"><Globe2 className="h-4 w-4" /> Public Atlas map location (optional)</legend>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={enabled} onChange={e => toggle(e.target.checked)} />
        <span>Show my campaign's <strong>approximate city or region</strong> as a public marker on the Atlas globe. Never use a home address or precise device location.</span>
      </label>
      {enabled && <>
        <label className="block text-sm font-medium">Quick place: choose a broad U.S. city area
          <select value="" onChange={event=>{
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
            onChange={e => change("public_location_label",e.target.value)}
            placeholder="e.g. Seattle area, Washington"
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Approximate latitude
            <input type="number" inputMode="decimal" step="0.1" min="-90" max="90"
              value={form.map_latitude ?? ""} onChange={e => change("map_latitude", e.target.value)}
              placeholder="47.6" className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background p-3" />
          </label>
          <label className="block text-sm font-medium">Approximate longitude
            <input type="number" inputMode="decimal" step="0.1" min="-180" max="180"
              value={form.map_longitude ?? ""} onChange={e => change("map_longitude",e.target.value)}
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
