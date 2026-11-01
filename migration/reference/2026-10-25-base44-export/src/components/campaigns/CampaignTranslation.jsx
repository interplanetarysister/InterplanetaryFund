import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Languages, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export const CAMPAIGN_LANGUAGES = Object.freeze([
  ["en", "English"],
  ["es", "Español — Spanish"],
  ["zh-Hans", "简体中文 — Chinese (Simplified)"],
  ["tl", "Tagalog / Filipino"],
  ["vi", "Tiếng Việt — Vietnamese"],
  ["ar", "العربية — Arabic"],
  ["fr", "Français — French"],
  ["ko", "한국어 — Korean"],
  ["pt", "Português — Portuguese"],
  ["hi", "हिन्दी — Hindi"],
]);

export default function CampaignTranslation({ campaign, canManage, onChange }) {
  const [selected, setSelected] = useState("original");
  const [available, setAvailable] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);

  useEffect(() => {
    let active = true;
    setSelected("original");
    setAvailable([]);
    setCurrentStatus(null);
    setLoadFailed(false);
    setNotice("");
    onChange(null);
    base44.functions.invoke("translateCampaign", { action: "list", campaign_id: campaign.id })
      .then(({ data }) => {
        if (active) setAvailable(Array.isArray(data?.languages) ? data.languages : []);
      })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [campaign.id, campaign.title, campaign.summary, campaign.story, canManage]);

  const openLanguage = async (code) => {
    setSelected(code);
    setNotice("");
    setCurrentStatus(null);
    onChange(null);
    if (code === "original") return;
    const found = available.find(item => item.language_code === code);
    if (!found) {
      setNotice(canManage
        ? "Tap Generate translation to prepare a version you can check before publishing."
        : "This language is not published yet.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke("translateCampaign", {
        action: "read", campaign_id: campaign.id, language_code: code,
      });
      if (!data?.translation?.title) throw new Error("Missing translation");
      onChange(data.translation);
      setCurrentStatus(data.translation.status);
    } catch {
      setNotice("This translation could not load. The original campaign is still available.");
    } finally { setBusy(false); }
  };

  const generate = async () => {
    if (!canManage || selected === "original" || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const { data } = await base44.functions.invoke("translateCampaign", {
        action: "generate", campaign_id: campaign.id, language_code: selected,
      });
      if (!data?.translation?.title) throw new Error("Missing translation");
      onChange(data.translation);
      setCurrentStatus(data.translation.status);
      setAvailable(old => [...old.filter(item => item.language_code !== selected),
        { language_code: selected, status: data.translation.status }]);
      setNotice("Read this translation carefully. Tap Publish when it is ready for everyone.");
    } catch {
      setNotice("We couldn't generate this translation. Your campaign has not changed.");
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!canManage || selected === "original" || currentStatus !== "draft" || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const { data } = await base44.functions.invoke("translateCampaign", {
        action: "publish", campaign_id: campaign.id, language_code: selected,
      });
      if (data?.translation?.status !== "published") throw new Error("Not published");
      setCurrentStatus("published");
      setAvailable(old => [...old.filter(item => item.language_code !== selected),
        { language_code: selected, status: "published" }]);
      setNotice("Translation published. Anyone can now read this version.");
    } catch {
      setNotice("Could not publish. Check the campaign text and try again.");
    } finally { setBusy(false); }
  };

  const isMissing = selected !== "original" && !available.some(x => x.language_code === selected);
  const languageLabel = CAMPAIGN_LANGUAGES.find(x => x[0] === selected)?.[1] || "";
  return (
    <section aria-label="Campaign language" className="rounded-xl border border-border bg-card text-card-foreground p-3 sm:p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Languages aria-hidden="true" className="w-5 h-5 text-primary shrink-0" />
        <label htmlFor="campaign-language" className="text-sm font-semibold">Read campaign in</label>
        <select id="campaign-language" value={selected} disabled={busy}
          onChange={(e) => openLanguage(e.target.value)}
          className="min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-input bg-background text-foreground px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <option value="original">Original language</option>
          {CAMPAIGN_LANGUAGES.filter(([code]) =>
            canManage || available.some(item => item.language_code === code && item.status === "published")
          ).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        {busy && <Loader2 className="w-4 h-4 animate-spin" aria-label="Working" />}
      </div>
      {canManage && isMissing && (
        <button type="button" onClick={generate} disabled={busy}
          className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-60">
          Generate translation
        </button>
      )}
      {canManage && currentStatus === "draft" && (
        <button type="button" onClick={publish} disabled={busy}
          className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-60">
          Publish {languageLabel} translation
        </button>
      )}
      {selected !== "original" && currentStatus && (
        <p className="text-xs text-muted-foreground">
          AI translated · {currentStatus === "draft" ? "Only you can see this preview." : "Published for readers."}
          {" "}Check important information against the original language.
        </p>
      )}
      {loadFailed && <p role="status" className="text-sm text-muted-foreground">Languages are unavailable right now. The original campaign is still here.</p>}
      {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
      {canManage && <Link to="/help/translate-a-campaign" className="inline-block text-xs underline text-primary">How translations work</Link>}
    </section>
  );
}
