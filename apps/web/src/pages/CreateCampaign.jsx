import AgentAdviceReview from "@/components/agents/AgentAdviceReview";
import CampaignTemplatePreview from "@/components/campaigns/CampaignTemplatePreview";
import { isTemplateCategory, isTemplateStyle, templateCategory, templateStyle } from "@/lib/campaignTemplates";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { uploadCampaignCover, validateCoverFile } from "@/api/campaignMedia";
import { makeDraftRequest, requestCampaignDraft } from "@/api/campaignDraft";
import { loadCampaignSetup, saveCampaignSetup, campaignSetupPayload } from "@/api/campaignSetup";
import { WIZARD_STEPS, emptyWizard, restoreWizard, rememberWizard, forgetWizard, importGuestWizard, withStoryVersion } from "@/lib/campaignWizard";
import AgentFeatureLauncher from "@/components/agents/AgentFeatureLauncher";
import { rememberPendingCampaignSetup, pendingCampaignSetup, clearPendingCampaignSetup } from "@/lib/campaignCreationRecovery.mjs";
import { createOwnerSessionGuard } from "@/lib/ownerSessionGuard";
import { createCampaignWritingRequests } from "@/lib/campaignWritingRequests";
import { CAMPAIGN_WRITING_PATHS, guidedCampaignDetails } from "@/lib/campaignWritingPaths";
import { loadOwnerCampaign, saveOwnerCampaign, isCampaignConflict } from "@/api/ownerCampaigns";
import { CAMPAIGN_CATEGORIES, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX, coverImageUrl, coverIsAI, validateCampaignForm, publishReadiness } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import MemberAccess from "@/components/auth/MemberAccess";
import { useAuthSession } from "@/hooks/useAuthSession";
import { restoreBrowserCampaign, restoreWritingBrief, emptyWritingBrief, rememberBrowserCampaign, forgetBrowserCampaign, hasUnclaimedGuestCampaign, importGuestCampaign } from "@/lib/browserCampaignDraft";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";
import CampaignVoiceInput from "@/components/campaigns/CampaignVoiceInput";
import CampaignVoiceGuide from "@/components/campaigns/CampaignVoiceGuide";
import CampaignImageChoices from "@/components/campaigns/CampaignImageChoices";
import { SUPPORT_NEEDS, supportNeed } from "@/lib/supportNeeds.mjs";
import { Target, BookOpen, Rocket } from "lucide-react";

import CampaignLocationFields from "@/components/atlas/CampaignLocationFields";
import ExternalCampaignHandoff from "@/components/campaigns/ExternalCampaignHandoff";
import CampaignDocuments from "@/components/campaigns/CampaignDocuments";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { linkCampaignToMission, loadMission } from "@/api/missions";

export default function CreateCampaign() {
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  if (!draftId && params.get("manual") !== "1" && !params.has("mission") && import.meta.env.VITE_IFUND_WHAT_IF_ENABLED === "enabled")
    return <Navigate to="/what-if" replace />;
  return <NewCampaign draftId={draftId} />;
}

function NewCampaign({ draftId = null }) {
  const session = useAuthSession();
  if (session.status === "loading") return <main className="mx-auto max-w-3xl px-4 py-8" role="status">Opening your campaign editor…</main>;
  // Anonymous Supabase sessions are guests, not durable draft owners.
  // Keep their browser draft eligible for handoff after email verification.
  const ownerId = session.user?.is_anonymous === true || !session.user?.email_confirmed_at ? null : (session.user?.id || null);
  // Reset all unsaved form and assistant state on account changes, preserving
  // only the explicit guest-to-first-owner handoff in scoped browser storage.
  const composer=<CampaignComposer key={(draftId || "new") + ":" + (ownerId || "guest")} ownerId={ownerId} memberAccess={Boolean(draftId)} />;
  // Confirmed members can accept the current agreement before their first save.
  // Guest drafting remains available; private saved drafts always require access.
  return ownerId || draftId ? <MemberAccess><CampaignEntry key={(ownerId||"guest")+":"+(draftId||"new")} ownerId={ownerId} draftId={draftId}>{composer}</CampaignEntry></MemberAccess> : composer;
}

function CampaignEntry({ownerId,draftId,children}){
  const [recovery]=useState(()=>{try{return ownerId&&!draftId?pendingCampaignSetup(sessionStorage,ownerId):null;}catch{return null;}});
  return recovery?<Navigate to={"/create?draft="+encodeURIComponent(recovery.campaignId)} replace />:children;
}

function CampaignComposer({ memberAccess = false, ownerId = null }) {
  const donationsEnabled = usePublicCampaignFundraising();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  // A homepage prompt is transient input for this exact editor, never a
  // separate Mission, payment authorization or permission to publish.
  const transferredPrompt = !draftId && location.state?.source === "home-what-if" &&
    typeof location.state.prompt === "string" && location.state.prompt.trim().length <= 1500
      ? location.state.prompt.trim() : "";
  const [landingPrompt] = useState(() => {
    if (!transferredPrompt) return "";
    try {
      const existing=restoreBrowserCampaign(sessionStorage,ownerId);
      const brief=restoreWritingBrief(sessionStorage,ownerId);
      // Never mix a newly submitted idea into an existing guest or owner draft.
      if(existing.title||existing.summary||existing.story||
        brief.details||brief.beneficiary||brief.need) return "";
    } catch { return ""; }
    return transferredPrompt;
  });
  const missionSourceId = params.get("mission");
  const validMissionSourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missionSourceId || "");
  const campaignId = useRef(draftId || null);
  const saveLock = useRef(false);
  const wizardSaveStep=useRef(null);
  const headingRef=useRef(null);
  const fieldToFocus=useRef(null);
  const storyEditStarted=useRef(false);
  const [wizard,setWizard]=useState(()=>{try{return restoreWizard(sessionStorage,ownerId,draftId);}catch{return emptyWizard();}});
  const [wizardError,setWizardError]=useState("");
  const [progressNotice,setProgressNotice]=useState("");
  const step=wizard.draft_step;
  useEffect(()=>{
    if(fieldToFocus.current){
      const target=document.getElementById(fieldToFocus.current);fieldToFocus.current=null;
      target?.scrollIntoView({behavior:"smooth",block:"center"});target?.focus({preventScroll:true});
    }else headingRef.current?.focus();
  },[step]);
  function focusCampaignField(field){
    const target=field==="title"?"campaign-title":field==="summary"?"campaign-summary":field==="goal_amount"?"campaign-goal":field==="category"?"campaign-category":field==="cover_image_url"?"campaign-cover-url":"campaign-story";
    fieldToFocus.current=target;
    setWizard(previous=>({...previous,draft_step:["title","goal_amount","category","cover_image_url"].includes(field)?0:1}));
  }
  // Explicit edits, not mount/effect replays, authorize clearing restored text.
  const userEditedDraft = useRef(false);
  const coverUploadLock = useRef(false);
  const writingLock = useRef(false);
  const writingRequests = useRef(new Map());
  const writingRevision = useRef(createCampaignWritingRequests());
  const storySectionsRef = useRef([]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; writingRevision.current.invalidate(); writingLock.current = false; }; }, []);
  const ownerScope=useRef(null);
  useEffect(()=>{
    if(!ownerId)return;
    const scope=createOwnerSessionGuard(authClient().auth,ownerId,()=>{
      alive.current=false;writingRevision.current.invalidate();
      setError("Your account changed. Reload the campaign editor before continuing.");
    });
    ownerScope.current=scope;
    return()=>{scope.dispose();if(ownerScope.current===scope)ownerScope.current=null;};
  },[ownerId]);
  const [loadedDraftId, setLoadedDraftId] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState("");
  useEffect(() => {
    if (!draftId) { setLoadingDraft(false); setDraftLoadError(""); return; }
    setLoadingDraft(true); setDraftLoadError("");
    let active = true;
    (async () => {
      try {
        const data = await loadOwnerCampaign(authClient(), draftId, ownerScope.current);
        if (data.status !== "draft") {
          try{if(ownerId&&pendingCampaignSetup(sessionStorage,ownerId,draftId))clearPendingCampaignSetup(sessionStorage,ownerId,draftId);}catch{/* Keep private recovery untouched if storage cannot be checked. */}
          throw new Error("This campaign is no longer a draft. Open My campaigns to view its current status.");
        }
        const setup=await loadCampaignSetup(authClient(),draftId,ownerScope.current);
        if (active && alive.current) {
          invalidateWriting();
          let recovery=null;try{recovery=pendingCampaignSetup(sessionStorage,ownerId,draftId);}catch{/* Account saves remain available without device storage. */}
          const restoredSetup=recovery?.setup||(setup?campaignSetupPayload({...setup,writing_brief:{...setup.ai_profile?.writing_brief,wizard_version:setup.ai_profile?.writing_brief?.wizard_version===2?2:1}},setup.draft_step):emptyWizard());
          if(recovery)setProgressNotice("Your campaign is saved. Recovered setup changes still need Save private draft to confirm them to your account.");
          setWizard(restoredSetup);
          const brief=restoredSetup.ai_profile.writing_brief;
          setWritingPath(CAMPAIGN_WRITING_PATHS.some(path=>path.id===brief.writingPath)?brief.writingPath:"write");
          setDraftDetails(brief.details);setDraftBeneficiary(brief.beneficiary);setDraftNeed(brief.need);
          setSupportType(supportNeed(brief.support_type).id);
          const sections=splitStory(data.story || "");
          storySectionsRef.current=sections;setStorySections(sections);
          setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:Number(data.goal_amount)>0 ? String(data.goal_amount) : "", cover_image_url:coverImageUrl(data.cover_image_url||""), cover_image_is_ai:restoredSetup.cover_image_is_ai===true||coverIsAI(data.cover_image_url), map_opt_in:data.map_opt_in===true, public_location_label:data.public_location_label||"", map_latitude:data.map_latitude===null ? "" : String(data.map_latitude), map_longitude:data.map_longitude===null ? "" : String(data.map_longitude) });
          setLoadedDraftId(draftId);
          setSaved(data.id);
          setSavedStatus("draft");
        }
      } catch (err) { if (active) setDraftLoadError(err?.message || "Unable to load draft."); }
      finally { if (active) setLoadingDraft(false); }
    })();
    return () => { active = false; };
  }, [draftId,navigate]);
  const [form, setForm] = useState(() => {
    try {
      if (!draftId) {
        const restored = restoreBrowserCampaign(sessionStorage, ownerId);
        if (!landingPrompt || restored.title || restored.summary || restored.story) return restored;
        // Fill only untouched fields; keep cover, location and donor inputs as-is.
        return {...restored,
          title:landingPrompt.split(/[.!?\n]/u)[0].trim().slice(0, TITLE_MAX),
          summary:landingPrompt.slice(0, SUMMARY_MAX)};
      }
    } catch { /* session storage unavailable */ }
    return { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "", cover_image_is_ai: false, map_opt_in: false, public_location_label: "", map_latitude: "", map_longitude: "" };
  });
  // A template link chooses a starting category and layout preview for a new
  // campaign only. It never overwrites restored or typed content, and nothing
  // is persisted beyond the normal campaign fields.
  const [previewViewport, setPreviewViewport] = useState("desktop");
  const templateParam = params.get("template");
  const [previewStyle] = useState(() => templateStyle(isTemplateStyle(templateParam) ? templateParam : templateCategory(params.get("category")).style).id);
  useEffect(() => {
    const requestedCategory = params.get("category");
    if (draftId || !isTemplateCategory(requestedCategory) || userEditedDraft.current) return;
    setForm(previous => (previous.title || previous.summary || previous.story)
      ? previous
      : { ...previous, category: requestedCategory });
  }, [draftId, params]);
  // Pre-fill only an empty new draft, and only with the current owner's private Mission.
  // User-entered or restored campaign content is never overwritten by a Mission.
  useEffect(() => {
    if (!validMissionSourceId || draftId || !ownerId || campaignId.current) return;
    let active=true;
    loadMission(authClient(),missionSourceId).then(m=>{
      if(!active || userEditedDraft.current)return;
      setForm(previous=>(previous.title||previous.summary||previous.story)
        ? previous
        : {...previous,title:m.title.slice(0,150),
            summary:(m.summary||m.original_prompt).slice(0,600)});
    }).catch(()=>{/* No foreign or inaccessible Mission data is applied. */});
    return ()=>{active=false;};
  },[validMissionSourceId,missionSourceId,draftId,ownerId]);
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState("");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [savedStatus, setSavedStatus] = useState("draft");
  const [browserSaved, setBrowserSaved] = useState(false);
  const [guestCopyRetained,setGuestCopyRetained] = useState(false);
  const [guestDecisionPending, setGuestDecisionPending] = useState(() => {
    if (!ownerId || draftId) return false;
    try { return hasUnclaimedGuestCampaign(sessionStorage); } catch { return true; } // Fail closed when guest ownership cannot be checked.
  });
  // Defense in depth: the parent keys this editor by verified owner, but an
  // unexpected no-remount identity transition must still fail closed before
  // any browser write or AI request can run for the new account.
  const initialOwnerId = useRef(ownerId);
  const ownerTransitionPending = initialOwnerId.current !== ownerId;
  useEffect(() => {
    if (!ownerTransitionPending) return;
    invalidateWriting(true);
    setGuestDecisionPending(true);
    setGuestImportMessage("Your account changed. Reload the campaign editor before importing or saving a browser draft.");
  }, [ownerId, ownerTransitionPending]);
  const privacyDecisionPending = guestDecisionPending || ownerTransitionPending;
  const [guestImportMessage, setGuestImportMessage] = useState("");
  const [autosaveError, setAutosaveError] = useState("");
  // A failed initial storage read must never be mistaken for an empty draft.
  // Require a successful read before any browser autosave or guest save.
  const [storageReadable, setStorageReadable] = useState(() => {
    try {
      sessionStorage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(ownerId || ""));
      sessionStorage.getItem("ifund-guest-campaign-v1:guest");
      sessionStorage.getItem("ifund-guest-campaign-v1");
      return true;
    } catch { return false; }
  });
  function retryStorageRead() {
    try {
      sessionStorage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(ownerId || ""));
      sessionStorage.getItem("ifund-guest-campaign-v1:guest");
      sessionStorage.getItem("ifund-guest-campaign-v1");
      // Reload so draft hydration reruns before autosave can resume.
      window.location.reload();
    } catch {
      setStorageReadable(false);
      setAutosaveError("Browser draft storage is still unavailable. Copy your work before leaving.");
    }
  }
  const [restoredBrief] = useState(() => {
    try {
      const restored=draftId ? emptyWritingBrief() : restoreWritingBrief(sessionStorage, ownerId);
      if(!landingPrompt || restored.details || restored.beneficiary || restored.need)return restored;
      return {...restored,details:landingPrompt};
    } catch { return landingPrompt ? {...emptyWritingBrief(),details:landingPrompt} : emptyWritingBrief(); }
  });
  const [writingPath, setWritingPath] = useState(restoredBrief.writingPath);
  const [draftDetails, setDraftDetails] = useState(restoredBrief.details);
  const [draftBeneficiary, setDraftBeneficiary] = useState(restoredBrief.beneficiary);
  const [draftNeed, setDraftNeed] = useState(restoredBrief.need);
  const [supportType,setSupportType] = useState(()=>supportNeed(wizard.ai_profile?.writing_brief?.support_type).id);
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [writingQueued, setWritingQueued] = useState(false);
  const [storySections, setStorySections] = useState(() => {
    const sections=splitStory(form.story);storySectionsRef.current=sections;return sections;
  });
  const [sectionProposals, setSectionProposals] = useState({});
  const [regeneratingSection, setRegeneratingSection] = useState(-1);
  const [sectionError, setSectionError] = useState("");
  function splitStory(story) {
    return String(story || "").split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  }
  function invalidateWriting(clearIdeas = false) {
    writingRevision.current.invalidate();writingLock.current=false;
    setSuggesting(false);setRegeneratingSection(-1);setSectionProposals({});
    setSuggestionError("");setSectionError("");setWritingQueued(false);
    if(clearIdeas)setSuggestions(null);
  }
  function editSection(index, value) {
    const sections=storySectionsRef.current.map((part,i)=>i===index?value:part);
    // Preserve raw textarea input: splitting/trimming here would eat spaces
    // while typing and remove emptied sections, shifting all later indices.
    invalidateWriting();
    storySectionsRef.current=sections;setStorySections(sections);
    userEditedDraft.current=true;setSaved("");setBrowserSaved(false);
    if(!storyEditStarted.current){setWizard(previous=>withStoryVersion(previous,form.story));storyEditStarted.current=true;}
    setForm(previous=>({...previous,story:sections.join("\n\n")}));
  }
  async function writingSuggestion(input) {
    input={...input,writing_preferences:{tone:wizard.ai_profile?.tone||"",never_change:wizard.ai_profile?.never_change||""}};
    const linkedCampaignId = ownerId ? (draftId || saved || campaignId.current || null) : null;
    const key = JSON.stringify({ ...makeDraftRequest(input), writing_preferences:input.writing_preferences, section: input.section || null, campaign_id: linkedCampaignId });
    let id = writingRequests.current.get(key);
    if (!id) {
      if (writingRequests.current.size >= 32) writingRequests.current.delete(writingRequests.current.keys().next().value);
      id = crypto.randomUUID(); writingRequests.current.set(key, id);
    }
    try {
      const result = await requestCampaignDraft(authClient(), { ...input, campaign_id: linkedCampaignId }, { requestId: id });
      writingRequests.current.delete(key);
      return result;
    } catch (error) {
      if (error?.code === "new_request_required") writingRequests.current.delete(key);
      throw error;
    }
  }
  async function regenerateSection(index) {
    if (privacyDecisionPending || writingLock.current || regeneratingSection !== -1 || suggesting || busy) return;
    const request=writingRevision.current.begin();
    if(!request)return;
    writingLock.current = true;
    setRegeneratingSection(index);
    setSectionError("");
    try {
      const original = storySectionsRef.current[index];
      const result = await writingSuggestion({
        details: ("Rewrite only this section of a campaign story, preserving all supplied facts. Original section: " + original + ". Campaign context: " + draftDetails).slice(0, 1500),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
        section: original,
      });
      if (!alive.current || !writingRevision.current.current(request)) return;
      const proposed = result.story.trim();
      if (!proposed) throw new Error("No replacement section returned.");
      setSectionProposals(previous => ({ ...previous, [index]: proposed }));
    } catch (err) {
      if (alive.current && writingRevision.current.current(request)) { setSectionError(err?.message || "Unable to regenerate section."); setWritingQueued(err?.code === "queued"); }
    } finally {
      if(writingRevision.current.finish(request)){
        writingLock.current = false;
        if (alive.current) setRegeneratingSection(-1);
      }
    }
  }

  async function suggestDraft() {
    if (privacyDecisionPending || writingLock.current || busy || suggesting || loadingDraft || draftLoadError) return;
    const request=writingRevision.current.begin();
    if(!request)return;
    writingLock.current = true;
    setSuggesting(true); setSuggestionError(""); setWritingQueued(false);
    try {
      const result = await writingSuggestion({
        details: guidedCampaignDetails(writingPath, draftDetails),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      if (!alive.current || !writingRevision.current.current(request)) return;
      setSuggestions(result);
      const sections=splitStory(result.story);storySectionsRef.current=sections;setStorySections(sections);
      setSectionProposals({});
    } catch (error) {
      if (alive.current && writingRevision.current.current(request)) { setSuggestionError(error?.message || "Could not prepare your draft."); setWritingQueued(error?.code === "queued"); }
    } finally {
      if(writingRevision.current.finish(request)){
        writingLock.current = false;
        if (alive.current) setSuggesting(false);
      }
    }
  }
  useEffect(() => {
    // A confirmed account save owns the current form until the user edits it.
    // Autosaving that same form again would recreate a browser copy immediately
    // after cleanup, or erase the retained-copy privacy warning on failure.
    if (!storageReadable || privacyDecisionPending || draftId || (saved && campaignId.current === saved)) return;
    try {
      const stored = rememberBrowserCampaign(sessionStorage, ownerId, form, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed }, { allowBlankOverwrite: userEditedDraft.current });
      setAutosaveError(stored ? "" : "Automatic draft saving failed. Copy your changes before leaving.");
    } catch { setAutosaveError("Browser storage is unavailable. Copy your changes before leaving."); }
  }, [form, draftId, saved, ownerId, writingPath, draftDetails, draftBeneficiary, draftNeed, privacyDecisionPending, storageReadable]);
  const disabled = Boolean((!storageReadable&&!draftId) || privacyDecisionPending || busy || coverUploading || handoffBusy || loadingDraft || draftLoadError || (draftId && loadedDraftId !== draftId));
  const readiness = publishReadiness(form);
  function decideGuestDraft(importIt) {
    if (ownerTransitionPending) return; // No consent can bridge two account identities without a remount.
    if (!importIt) {
      setGuestCopyRetained(false);
      setGuestImportMessage("Guest draft kept separately on this device.");
      setGuestDecisionPending(false);
      return;
    }
    try {
      const outcome = importGuestCampaign(sessionStorage, ownerId);
      if (outcome.status !== "imported" && outcome.status !== "imported_guest_retained") {
        setGuestImportMessage(outcome.status === "owner_exists"
          ? "This account already has a browser draft. It was not overwritten. Choose Keep separate."
          : "Import could not be completed (" + outcome.status.replaceAll("_", " ") + "). The guest draft was not intentionally deleted. Choose Keep separate.");
        return;
      }
      const restored=restoreBrowserCampaign(sessionStorage, ownerId);
      invalidateWriting(true);
      storySectionsRef.current=splitStory(restored.story);setStorySections(storySectionsRef.current);
      setForm(restored);
      const wizardTransferred=importGuestWizard(sessionStorage,ownerId);
      if(wizardTransferred)setWizard(restoreWizard(sessionStorage,ownerId,null));
      else setWizardError("The campaign draft was imported, but its separate setup progress could not be moved. The original guest setup was kept.");
      const brief = restoreWritingBrief(sessionStorage, ownerId);
      setWritingPath(brief.writingPath); setDraftDetails(brief.details);
      setDraftBeneficiary(brief.beneficiary); setDraftNeed(brief.need);
      setGuestCopyRetained(outcome.status === "imported_guest_retained");
      setGuestImportMessage(outcome.status === "imported_guest_retained" ? "Draft imported, but the guest copy could not be removed from this device. Private information may remain accessible to another guest. Retry cleanup below or avoid this shared device." : "Guest draft imported into this account.");
      setGuestDecisionPending(false);
    } catch {
      setGuestImportMessage("Browser storage failed. Guest draft was not intentionally deleted. Choose Keep separate.");
    }
  }
  function retryGuestCopyCleanup(){
    // Explicit retry, never an unattended deletion. Only a byte-identical
    // owner copy can authorize cleanup of its matching guest source.
    if (!ownerId || ownerTransitionPending || disabled) return;
    try {
      const outcome=importGuestCampaign(sessionStorage,ownerId);
      if(outcome.status==="imported"){
        setGuestCopyRetained(false);
        setGuestImportMessage("The duplicate guest campaign draft was removed from this browser. Your account draft remains unchanged.");
      } else {
        setGuestCopyRetained(true);
        setGuestImportMessage(outcome.status==="owner_exists"
          ? "The owner draft or guest draft has changed since import. Neither was overwritten or removed. Review this device's browser drafts before clearing anything."
          : "Guest draft cleanup could not be verified ("+outcome.status.replaceAll("_"," ")+"). The guest copy may still be accessible on this device.");
      }
    } catch {
      setGuestCopyRetained(true);
      setGuestImportMessage("Browser storage blocked the cleanup attempt. Your account draft was not changed.");
    }
  }
  function change(key, value) {
    if(key==="category"||key==="goal_amount")invalidateWriting(true);
    if(key==="story"){
      if(!storyEditStarted.current){setWizard(previous=>withStoryVersion(previous,form.story));storyEditStarted.current=true;}
      invalidateWriting();
      storySectionsRef.current=splitStory(value);setStorySections(storySectionsRef.current);
    }
    userEditedDraft.current = true; setSaved(""); setBrowserSaved(false); setForm(prev => ({ ...prev, [key]: value }));
  }
  function applyCampaignFields(fields) {
    if(typeof fields.story==="string")setWizard(previous=>withStoryVersion(previous,form.story));
    invalidateWriting();
    if(typeof fields.story==="string"){
      storySectionsRef.current=splitStory(fields.story);setStorySections(storySectionsRef.current);
    }
    userEditedDraft.current=true;setForm(previous=>({...previous,...fields}));setSaved("");setBrowserSaved(false);
  }
  function changeWritingBrief(setter, value) {
    invalidateWriting(true);
    // Writing-brief edits are user edits too: otherwise a prior server receipt
    // suppresses browser autosave and silently loses the updated brief.
    userEditedDraft.current = true;
    setSaved("");
    setBrowserSaved(false);
    setter(value);
  }
  function wizardSnapshot(nextStep=step){
    return campaignSetupPayload({...wizard,cover_image_is_ai:form.cover_image_is_ai===true,writing_brief:{wizard_version:2,writingPath,details:draftDetails,beneficiary:draftBeneficiary,need:draftNeed,support_type:supportType}},nextStep);
  }
  function changeWizard(field,value){
    invalidateWriting(true);setSaved("");setProgressNotice("");
    setWizard(previous=>({...previous,[field]:value}));
  }
  function changeWritingPreference(field,value){
    invalidateWriting(true);setSaved("");setProgressNotice("");
    setWizard(previous=>({...previous,ai_profile:{...previous.ai_profile,[field]:value}}));
  }
  async function advanceWizard(next){
    if(disabled||saveLock.current||!Number.isInteger(next)||next<0||next>2)return;
    if(form.title.trim()&&(ownerId||next>step)){
      wizardSaveStep.current=next;
      try{if(await save("draft")){if(alive.current)setWizard(previous=>({...previous,draft_step:next}));}}
      finally{wizardSaveStep.current=null;}
      return;
    }
    try{
      const snapshot=wizardSnapshot(next);
      if(!rememberWizard(sessionStorage,ownerId,draftId,snapshot))throw Error("Setup progress could not be saved on this device. Copy your answers before leaving.");
      setWizard(snapshot);setWizardError("");setProgressNotice("Progress saved in this browser tab. Account saving starts after you add a campaign title.");
    }catch(cause){setWizardError(cause.message||"Setup progress could not be saved.");}
  }
  useEffect(()=>{
    if(privacyDecisionPending||!storageReadable||draftId||(saved&&campaignId.current===saved))return;
    try{if(!rememberWizard(sessionStorage,ownerId,null,wizardSnapshot()))setWizardError("Setup progress could not be saved on this device. Keep this tab open.");else setWizardError("");}
    catch(cause){setWizardError(cause.message||"Setup progress could not be saved.");}
  },[wizard,writingPath,draftDetails,draftBeneficiary,draftNeed,ownerId,draftId,privacyDecisionPending,storageReadable,saved]);
  async function handleCoverUpload(file) {
    if (coverUploadLock.current || !file) return;
    const problem = validateCoverFile(file);
    if (problem) { setError(problem); return; }
    coverUploadLock.current = true;
    setCoverUploading(true);
    setCoverUploadMessage("");
    setError("");
    try {
      const url = await uploadCampaignCover(authClient(), file);
      if (!alive.current) return;
      applyCampaignFields({cover_image_url:coverImageUrl(url),cover_image_is_ai:false});
      setCoverUploadMessage("Your cover image uploaded. Save this draft or publish to attach it to your campaign.");
    } catch (cause) {
      if (alive.current) setError(cause?.message || "The cover image could not be uploaded. Try a smaller JPG or PNG.");
    } finally {
      coverUploadLock.current = false;
      if (alive.current) setCoverUploading(false);
    }
  }
  async function save(status) {
    if (saveLock.current || disabled) return;
    saveLock.current = true;
    // Keep the last confirmed server receipt while retrying a save. Clearing it
    // here would briefly re-enable the browser autosave effect and recreate a
    // local copy even when no campaign field was edited.
    setBusy(status); setError("");
    try {
      let client; let user;
      try {
        client = authClient();
        const result = await client.auth.getUser();
        if (!result.error) user = result.data?.user;
      } catch { /* Guest editor remains available without an account. */ }
      if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) {
        // A failed auth refresh in a previously verified editor must NOT
        // silently downgrade an account-owned draft into the guest slot.
        if (ownerId) {
          setError("Your account session could not be verified. Copy any unsaved changes and sign in again before saving.");
          return;
        }
        if (status === "active") {
          setError("Publishing requires a secure account with a verified owner ID. Your draft remains in this browser; you can continue without verifying your identity, but public publishing is not available in browser-only mode.");
          return;
        }
        try {
          const stored = rememberBrowserCampaign(sessionStorage, null, form, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed }, { allowBlankOverwrite: userEditedDraft.current });
          const wizardStored=rememberWizard(sessionStorage,null,null,wizardSnapshot(wizardSaveStep.current??step));
          setBrowserSaved(stored&&wizardStored);
          if (!stored||!wizardStored) setError("A draft from another account is stored in this tab. Your changes were not saved. Copy your work before switching accounts or tabs.");
          return stored&&wizardStored;
        } catch { throw new Error("Browser storage is unavailable. Copy your draft before leaving."); }
      }
      // A verified account can change while this editor is mounted (for example,
      // another tab signs out and a different account signs in). Never save
      // the previous account's private form under the newly active identity.
      if (!ownerId || user.id !== ownerId) {
        setError("Your account changed while editing. Copy any unsaved changes, then reload the campaign editor before saving.");
        return;
      }
      const problems = validateCampaignForm(form, { publish: status === "active" });
      if (problems.length) { setError(problems[0]); return; }
      const scope=ownerScope.current;
      if(!scope)throw Error("Your account could not be verified. Reload before saving.");
      scope.assertActive();
      const setupToSave=wizardSnapshot(wizardSaveStep.current??step);
      const data = await saveOwnerCampaign(client, form, { id: campaignId.current, status:"draft", expectedStatus: "draft", scope });
      // Set the receipt before routing so another click cannot insert a second
      // campaign while React is committing the new URL.
      scope.assertActive();
      campaignId.current = data.id;
      setSaved(data.id);
      let recoveryStored=false;try{recoveryStored=rememberPendingCampaignSetup(sessionStorage,ownerId,data.id,setupToSave);}catch{/* Preserve the confirmed account receipt below. */}
      if(!recoveryStored)setAutosaveError("Campaign data is saved, but setup recovery could not be kept in this browser. Keep this page open until setup saving succeeds.");
      await saveCampaignSetup(client,data.id,setupToSave,setupToSave.draft_step,scope);
      let missionLinkIssue = "";
      if (validMissionSourceId) {
        try { await linkCampaignToMission(client,missionSourceId,data.id); }
        catch (cause) { missionLinkIssue = cause?.message || "The Mission link could not be confirmed."; }
      }
      if(status==="active")await saveOwnerCampaign(client,form,{id:data.id,status:"active",expectedStatus:"draft",scope});
      if(!alive.current)return false;
      setSavedStatus(status);setProgressNotice(missionLinkIssue
        ? "Campaign saved, but its Mission association needs attention: "+missionLinkIssue
        : "Campaign and setup progress saved to your account.");
      storyEditStarted.current=false;
      // A server save succeeded, but local cleanup can fail (disabled storage,
      // malformed legacy data, or a blocked removeItem). Do not report that
      // the browser copy was removed unless cleanup actually succeeded.
      let browserCleanupFailed = false;
      try {
        const cleared = forgetBrowserCampaign(sessionStorage, ownerId);
        const wizardNewCleared=forgetWizard(sessionStorage,ownerId,null);
        const wizardCampaignCleared=forgetWizard(sessionStorage,ownerId,data.id);
        const recoveryCleared=clearPendingCampaignSetup(sessionStorage,ownerId,data.id);
        const wizardCleared=wizardNewCleared&&wizardCampaignCleared&&recoveryCleared;
        browserCleanupFailed = !cleared||!wizardCleared;
        if (browserCleanupFailed) setAutosaveError("Campaign saved to your account, but an older browser draft could not be cleared. It may contain private information on this device. Review browser storage before using a shared device.");
        else setAutosaveError("");
      } catch {
        browserCleanupFailed = true;
        setAutosaveError("Campaign saved to your account, but browser draft cleanup failed. An older copy may remain on this device.");
      }
      setBrowserSaved(false);
      // Keep the accessible warning mounted if cleanup fails; navigating away
      // immediately would discard the only visible notice of retained data.
      if (!browserCleanupFailed) {
        if (status === "active") navigate(`/campaign/${encodeURIComponent(data.id)}`);
        else if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
      }
      return true;
    } catch (err) {
      if(!alive.current)return false;
      setError(err?.message || "Your campaign could not be saved.");
      if (isCampaignConflict(err)) setDraftLoadError("This campaign changed in another session. Open My campaigns before making further changes.");
    }
    finally { saveLock.current = false; if(alive.current)setBusy(false); }
  }
  const stepIcons = [Target, BookOpen, Rocket];
  const actions = <div className="flex flex-wrap gap-3">
    <button form="campaign-editor" type="submit" disabled={disabled} className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save draft"}</button>
    {step===2&&<button type="button" onClick={() => save("active")} disabled={disabled || !readiness.ready} aria-describedby="campaign-publish-readiness" className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy === "active" ? "Publishing…" : "Publish campaign"}</button>}
  </div>;
  return <main className={"mx-auto max-w-3xl space-y-6 px-4 py-8"+(step===2?" ifund-eclipse-moment":"")}>
    {landingPrompt && <p role="status" aria-label="Your starting idea" className="text-sm font-medium text-cyan-700 dark:text-cyan-200">Your idea is ready in the draft below. Edit it however you like.</p>}
    {!landingPrompt && transferredPrompt && <p role="status" className="rounded-xl border border-amber-400/40 p-4 text-sm">An existing draft was found, so your new idea was not merged into it. Your earlier work remains unchanged. To start a separate idea, save or finish that draft first.</p>}
    <header className="flex items-center justify-between gap-3"><h1 ref={headingRef} tabIndex={-1} className="font-display text-xl font-bold">New Campaign</h1><span className="text-xs text-muted-foreground">{step+1} / 3</span></header>
    {step===2 && <p className="ifund-eclipse-caption text-center text-sm font-semibold">Your defining moment · Review before publishing</p>}
    {templateParam && <p role="status" className="text-xs text-primary">Starting layout: {templateStyle(previewStyle).name}</p>}
    <nav aria-label="Campaign setup progress" className="mx-auto max-w-xl"><ol className="grid grid-cols-3 gap-3">{WIZARD_STEPS.map((label,index)=>{const Icon=stepIcons[index];return <li key={label} aria-current={step===index?"step":undefined} className="flex justify-center"><button type="button" title={label} aria-label={"Step "+(index+1)+": "+label} disabled={disabled||index>step} onClick={()=>advanceWizard(index)} className={"flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors disabled:opacity-60 "+(step===index?"border-cyan-300 bg-indigo-500 text-white shadow-lg shadow-indigo-700/30":"border-border bg-card text-muted-foreground")}><Icon size={24} aria-hidden="true"/></button></li>})}</ol></nav>
    <details><summary className="cursor-pointer text-sm text-primary">More agent help (optional)</summary><div className="mt-3"><AgentFeatureLauncher campaignId={ownerId?(draftId||saved||campaignId.current):null} disabled={disabled} /></div></details>
    {wizardError&&<p role="alert" className="rounded-xl border border-destructive p-4">{wizardError}</p>}
    {progressNotice&&<p role="status" className="text-sm text-muted-foreground">{progressNotice}</p>}
    {!storageReadable && <section role="alert" className="rounded-xl border border-destructive p-4 space-y-2">
      <p>{draftId?"Browser draft storage could not be read. Your account draft can still be saved; a device copy may remain until storage is available.":"Browser draft storage could not be read. Saving is paused to protect any existing private draft. Copy your work before leaving this page."}</p>
      <button type="button" onClick={retryStorageRead} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Retry browser storage</button>
    </section>}
    {guestDecisionPending && <section role="region" aria-label="Guest draft transfer" className="space-y-3 rounded-xl border p-3"><p>A guest campaign draft is stored on this device and may belong to another person. Import it only if it is yours. Existing account drafts will not be overwritten.</p><div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded border px-3" onClick={() => decideGuestDraft(true)}>Import my guest draft</button><button type="button" className="min-h-11 rounded border px-3" onClick={() => decideGuestDraft(false)}>Keep separate</button></div></section>}
    {guestImportMessage && <section className="space-y-2 rounded-xl border border-border p-3" aria-live="polite">
      <p className="text-sm break-words">{guestImportMessage}</p>
      {guestCopyRetained && <button type="button" disabled={disabled || !ownerId} onClick={retryGuestCopyCleanup} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50">Retry guest-copy cleanup</button>}
    </section>}
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError} <Link to="/campaigns" className="inline-flex min-h-11 items-center underline">My campaigns</Link></p>}
    <div hidden={step!==0}><details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">Already fundraising somewhere else? (optional)</summary><div className="mt-4"><ExternalCampaignHandoff form={form} disabled={privacyDecisionPending || loadingDraft || Boolean(draftLoadError) || (draftId && loadedDraftId !== draftId)} /></div></details></div>
    <div hidden={step!==1}><CampaignDocuments key={(ownerId||"guest")+":"+(draftId||saved||campaignId.current||"new")} campaignId={draftId||saved||campaignId.current||null} ownerId={ownerId} /></div>
    {step===1&&<details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">More writing help (optional)</summary><div className="mt-4"><AgentAdviceReview ownerId={ownerId} campaignId={draftId || null} currentStory={form.story} disabled={disabled} onBusyChange={setHandoffBusy} onApply={text => change("story",text)} /></div></details>}
    <div hidden={step!==1}><WritingDraftReview onBusyChange={setHandoffBusy} ownerId={ownerId} campaignId={draftId || null} disabled={disabled} onApply={copy => { applyCampaignFields(copy); setError(""); }} /></div>
    <section hidden={step!==0&&step!==1} className="ifund-cosmic-panel mx-auto max-w-2xl space-y-4 rounded-3xl border border-cyan-400/20 bg-card p-5 shadow-xl sm:p-8" aria-label="Campaign writing assistant">
      <fieldset disabled={disabled} className="space-y-4">
      <div hidden={step!==0} className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-cyan-700 dark:text-cyan-300">Tell us what matters</h2>
      <p className="text-sm text-muted-foreground">A few clues are enough. Everything else is optional.</p>
      <label className="block font-semibold">Working campaign title
        <input id="campaign-working-title" maxLength={TITLE_MAX} value={form.title} onChange={event=>change("title",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>

      <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Campaign type (optional)</summary><fieldset className="mt-3 space-y-3">
        <legend className="sr-only">What kind of campaign are you creating?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAMPAIGN_WRITING_PATHS.map(path => <label key={path.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${writingPath === path.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="radio" name="writingPath" value={path.id} checked={writingPath === path.id} onChange={() => changeWritingBrief(setWritingPath, path.id)} disabled={busy || loadingDraft} />
            <span>{path.title}</span>
          </label>)}
        </div>
      </fieldset></details>

      <label className="block font-semibold">What are we making possible?
        <textarea rows={4} maxLength={1500} value={draftDetails} disabled={busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => changeWritingBrief(setDraftDetails, e.target.value)} placeholder="A short goal, in your own words…"
          className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <CampaignVoiceInput value={draftDetails} onChange={value=>changeWritingBrief(setDraftDetails,value)} disabled={disabled}/>
      <CampaignVoiceGuide
        supportType={supportType}
        onDetails={text=>changeWritingBrief(setDraftDetails,text)}
        onBeneficiary={text=>changeWritingBrief(setDraftBeneficiary,text)}
        onNeed={text=>changeWritingBrief(setDraftNeed,text)}
        onGoal={amount=>change("goal_amount",amount)}
        onStory={text=>change("story",text)}
        onTone={text=>changeWritingPreference("tone",text)}
        disabled={disabled}
      />
      <label className="block font-semibold">Who or what is this for? (optional)
        <input maxLength={100} value={draftBeneficiary} disabled={busy}
          onChange={e => changeWritingBrief(setDraftBeneficiary, e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">What feeling should the story and images convey? (optional)<input maxLength={200} value={wizard.ai_profile.tone} onChange={event=>changeWritingPreference("tone",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" placeholder="Let AI choose, hopeful, comforting, bold…" /></label>
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">A little more context (optional)</summary><div className="mt-4 space-y-4">
      <label className="block font-semibold">What resources or help would make this possible? (optional)
        <input maxLength={100} value={draftNeed} disabled={busy}
          onChange={e => changeWritingBrief(setDraftNeed, e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">Essential facts or image details to depict accurately (optional)<textarea maxLength={2000} rows={4} value={wizard.ai_profile.never_change} onChange={event=>changeWritingPreference("never_change",event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>

      </div></details>
      </div><div hidden={step!==1} className="space-y-4">
      <h2 className="text-xl font-semibold">Campaign writing assistant</h2>
      <button type="button" onClick={suggestDraft}
        disabled={suggesting || busy || loadingDraft || Boolean(draftLoadError) || draftDetails.trim().length < 12}
        className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">
        {suggesting ? "Preparing ideas…" : "Generate campaign ideas"}
      </button>
      {suggestionError && <p role="alert" className="text-destructive">{suggestionError} <Link to="/permissions" className="underline">Review AI permissions in My Profile</Link></p>}
      {writingQueued && <p className="text-sm"><Link to="/agents" className="underline">View saved writing requests</Link></p>}
      {suggestions && <div aria-label="Campaign ideas" className="space-y-4" role="region">
        <p role="status" className="text-sm">{suggesting || suggestionError ? (suggestions.assistance === "outline" ? "Your previous basic outline remains available below for review." : "Your previous writing suggestions remain available below for review.") : suggestions.assistance === "outline" ? "A basic outline is ready, using only the facts you supplied. Edit it and choose what to include." : "Writing suggestions are ready. Check the facts and choose which ideas to apply below."}</p>
        <h3 className="font-semibold">Title ideas</h3>
        {suggestions.titles.map((v, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1">{v}</p>
          <button type="button" className="rounded-xl border border-border px-4 py-2"
            onClick={() => change("title",v)}>Use title</button>
        </div>)}
        <h3 className="font-semibold">Short descriptions</h3>
        {suggestions.summaries.map((v, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1">{v}</p>
          <button type="button" className="rounded-xl border border-border px-4 py-2"
            onClick={() => change("summary",v)}>Use description</button>
        </div>)}
        <h3 className="font-semibold">Story idea</h3>
        <p className="whitespace-pre-wrap">{suggestions.story}</p>
        <button type="button" className="rounded-xl border border-border px-4 py-2"
          onClick={() => change("story",suggestions.story)}>Use story</button>
        {suggestions.imagePrompt && <details><summary>Suggested illustration concept (no image generated)</summary>
          <p>{suggestions.imagePrompt}</p>
        </details>}
      </div>}
      {storySections.length>0&&<>
        <div className="space-y-4" aria-label="Story section editor">
          <p className="text-sm text-muted-foreground">{suggestions?.assistance === "outline" ? "Edit this basic outline section by section, then apply your edited story below." : "Edit each section separately. Rewriting produces a suggestion for your review and never overwrites other sections."}</p>
          {storySections.map((part, index) => <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <label className="block font-semibold">Section {index + 1}
              <textarea rows={5} value={part} onChange={e => editSection(index,e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" />
            </label>
            <button type="button" disabled={suggestions?.assistance === "outline" || regeneratingSection !== -1 || suggesting || busy} onClick={() => regenerateSection(index)} className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
              {regeneratingSection === index ? "Generating…" : "Regenerate this section"}
            </button>
            {sectionProposals[index] && <div className="space-y-2 rounded-xl border border-primary/30 p-3">
              <p className="font-semibold">Suggested replacement</p>
              <p className="whitespace-pre-wrap">{sectionProposals[index]}</p>
              <button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => { editSection(index,sectionProposals[index]); setSectionProposals(previous => { const next = {...previous}; delete next[index]; return next; }); }}>Accept</button>
              <button type="button" className="ml-2 rounded-xl border border-border px-4 py-2" onClick={() => setSectionProposals(previous => { const next = {...previous}; delete next[index]; return next; })}>Discard</button>
            </div>}
          </div>)}
          {sectionError && <p role="alert">{sectionError}</p>}
          <button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => change("story",storySections.join("\n\n"))}>Use edited story sections</button>
        </div>
      </>}
      </div></fieldset>
    </section>
    <form hidden={step===2} id="campaign-editor" onSubmit={event => { event.preventDefault(); save("draft"); }} className="ifund-cosmic-panel space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <fieldset disabled={disabled} className="space-y-5">
      <div hidden={step!==0} className="space-y-5"><label className="block font-semibold">Campaign title<input id="campaign-title" maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      </div><div hidden={step!==1} className="space-y-5"><label className="block font-semibold">Short description (optional)<textarea id="campaign-summary" aria-label="Short description" maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <p className="text-sm text-muted-foreground">Write as much or as little as you need. There is no minimum story length or required paragraph format.</p>
      <label className="block font-semibold">Your story<textarea id="campaign-story" aria-label="Your story" maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      </div><div hidden={step!==0} className="space-y-5"><label className="block font-semibold">Category<select id="campaign-category" value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">What kind of support would help you achieve your goal?
        <select id="campaign-support-type" value={supportType} onChange={e=>changeWritingBrief(setSupportType,e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">
          {SUPPORT_NEEDS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{supportNeed(supportType).examples}</span>
      </label>
            <label className="block font-semibold">Fundraising goal (USD)<input id="campaign-goal" inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      {supportType!=="money"&&<p className="text-sm text-muted-foreground">iFund can help find noncash support. Your private Mission can request {supportNeed(supportType).label.toLowerCase()} without a dollar target. Publishing a donation-collecting campaign still needs a positive cash goal. <Link className="underline" to="/what-if">Explore a support-only Mission</Link>.</p>}
      <div id="campaign-cover" className="space-y-3 rounded-2xl border border-border p-4" aria-label="Campaign cover image">
        <div>
          <h3 className="font-semibold">Campaign cover image (optional)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Upload a JPG, PNG, WebP or AVIF image up to 5 MB. Uploaded covers are publicly viewable when someone has their link; do not upload private documents or images without permission.</p>
        </div>
        <label className="block text-sm font-semibold">Upload your cover
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled}
            onChange={event => { const file=event.currentTarget.files?.[0]; event.currentTarget.value=""; if(file) void handleCoverUpload(file); }}
            className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
        </label>
        {coverUploading && <p role="status" className="text-sm text-blue-700">Uploading cover image securely… Saving and publishing are temporarily disabled.</p>}
        <CampaignImageChoices
          title={form.title} description={(form.summary||form.story||draftDetails).slice(0,900)}
          onApply={(url,provenance)=>{applyCampaignFields({cover_image_url:coverImageUrl(url),cover_image_is_ai:provenance?.cover_image_is_ai===true});setCoverUploadMessage("Your original iFund illustration is selected. Save your campaign draft to retain the cover.");}}
          disabled={disabled}
        />
        {coverUploadMessage && <p role="status" className="text-sm text-emerald-700">{coverUploadMessage}</p>}
        <label className="block text-sm font-semibold">Or paste an image URL
          <input id="campaign-cover-url" type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url}
            onChange={event => { const url=event.target.value; applyCampaignFields({cover_image_url:coverImageUrl(url),cover_image_is_ai:coverIsAI(url)}); setCoverUploadMessage(""); }}
            className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
        </label>
        {form.cover_image_url && <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">Cover preview — confirm the image displays before publishing</p>
          <img src={form.cover_image_url} alt="Campaign cover preview" loading="lazy" className="max-h-56 w-full rounded-lg object-contain" />
        </div>}
      </div>
      <label className="block font-semibold">Optional campaign end date<input type="date" value={wizard.end_date||""} onChange={event=>changeWizard("end_date",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Private location note<input maxLength={160} value={wizard.location} onChange={event=>changeWizard("location",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <p className="text-sm text-muted-foreground">This setup note stays private. Public Atlas placement below is a separate choice.</p>
      <CampaignLocationFields form={form} change={change} disabled={disabled} />
      </div>
      </fieldset>
    </form>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {browserSaved && <p role="status" className="rounded-xl border border-cyan-500/40 p-4">Draft saved in this browser tab only. It has not been uploaded or published. Keep this tab open until your account is linked.</p>}
      {saved && !loadingDraft && !draftLoadError && <p role="status" className="rounded-xl border border-border p-4">{savedStatus === "active" ? "Campaign published to your account." : "Private draft saved to your account."} <Link to={savedStatus==="active"?`/campaign/${encodeURIComponent(saved)}`:`/create?draft=${encodeURIComponent(saved)}`} className="underline">View saved campaign</Link></p>}

    {step===1&&wizard.story_versions.length>0&&<details className="rounded-xl border border-border p-4"><summary>Previous story versions ({wizard.story_versions.length})</summary><ul className="space-y-3 pt-3">{wizard.story_versions.map((version,index)=><li key={index} className="space-y-2"><p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm">{version.text}</p><button type="button" disabled={disabled} onClick={()=>change("story",version.text)} className="min-h-11 rounded-lg border px-3 text-sm">Restore this version</button></li>)}</ul></details>}
    {step===2&&<section aria-label="Campaign launch review" className="space-y-3 rounded-xl border border-border p-5"><h2 className="text-xl font-semibold">{form.title||"Untitled campaign"}</h2><p>{form.summary||"No optional short description added."}</p><p className="whitespace-pre-wrap">{form.story||"Add your campaign story before publishing."}</p><p className="text-sm text-muted-foreground">{wizard.end_date?"End date: "+wizard.end_date:"No end date set"}. Private setup details are never published by this review.</p></section>}
    {step===2&&<details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">Preview your campaign layout</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">This preview uses your current words. It never invents donations, supporters or progress: your published campaign shows only verified activity, and a goal is not a promise of funds.</p>
        <div className="inline-flex rounded-xl border border-border p-1" role="group" aria-label="Preview size">
          <button type="button" onClick={()=>setPreviewViewport("desktop")} aria-pressed={previewViewport==="desktop"} className={"min-h-11 rounded-lg px-4 text-sm font-medium "+(previewViewport==="desktop"?"bg-primary text-primary-foreground":"")}>Desktop</button>
          <button type="button" onClick={()=>setPreviewViewport("mobile")} aria-pressed={previewViewport==="mobile"} className={"min-h-11 rounded-lg px-4 text-sm font-medium "+(previewViewport==="mobile"?"bg-primary text-primary-foreground":"")}>Mobile</button>
        </div>
        <CampaignTemplatePreview template={previewStyle} category={form.category} content={form} viewport={previewViewport} />
      </div>
    </details>}
    {autosaveError && <div role="alert" className="space-y-2 text-sm text-destructive break-words"><p>{autosaveError}</p>{saved && <Link className="inline-block underline font-semibold" to={savedStatus==="active"?`/campaign/${encodeURIComponent(saved)}`:`/create?draft=${encodeURIComponent(saved)}`}>View saved campaign</Link>}</div>}
    {step===2&&<p className="text-sm text-muted-foreground">Publishing does not require an AI review or a story-length target. You may improve your campaign afterward in Command Center.</p>}
    <section hidden={step!==2} aria-label="Save or publish campaign" className="ifund-cosmic-panel space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div id="campaign-publish-readiness" aria-live="polite">
        <h2 className="text-xl font-semibold">{readiness.ready ? "Ready to publish" : "Before you publish"}</h2>
        {readiness.ready ? <p className="mt-2 text-sm text-muted-foreground">Publishing makes your campaign visible on Discover and gives you a public link to share.</p>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
      <p className="text-sm text-muted-foreground">{donationsEnabled ? "Publishing makes this active campaign eligible for verified PayPal donations." : "Campaign checkout is temporarily unavailable; you can still save and publish."}</p>
      {actions}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
      <button type="button" disabled={disabled||step===0} onClick={()=>advanceWizard(step-1)} className="min-h-12 rounded-xl border border-border px-5 font-semibold disabled:opacity-50">Back</button>
      {step<2&&<button type="button" disabled={disabled} onClick={()=>advanceWizard(step+1)} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">Continue</button>}
      {step<2&&<button type="button" disabled={disabled} onClick={()=>save("draft")} className="min-h-12 rounded-xl border border-border px-5 font-semibold">Save private draft</button>}
    </div>
  </main>;
}
