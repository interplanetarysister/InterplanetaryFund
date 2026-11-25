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
import PremiumOpportunity from "@/components/subscriptions/PremiumOpportunity";
import TrialCreationBalance from "@/components/subscriptions/TrialCreationBalance";
import { SUPPORT_NEEDS, supportNeed } from "@/lib/supportNeeds.mjs";
import { Target, BookOpen, Rocket } from "lucide-react";
import { CampaignLaunchProgress } from "@/components/campaigns/CampaignLaunchSuccess";

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
  useEffect(()=>{
    // The first sentence in a user's own words is sufficient to start a draft.
    // Only seed EMPTY story/summary fields; never overwrite manually edited text.
    if(step!==1||!draftDetails.trim()||loadingDraft||draftLoadError)return;
    setForm(previous=>previous.story.trim()?previous:{
      ...previous,
      story:draftDetails.trim(),
      summary:previous.summary||draftDetails.trim().slice(0,SUMMARY_MAX)
    });
  },[step,draftDetails,loadingDraft,draftLoadError]);

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
      if(result?.ai_inference===true)window.dispatchEvent(new Event("ifund-ai-creation-completed"));
      return result;
    } catch (error) {
      if (error?.code === "new_request_required") writingRequests.current.delete(key);
      if (error?.code === "queued") window.dispatchEvent(new Event("ifund-ai-creation-completed"));
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
        if (status === "active") navigate(`/campaign/${encodeURIComponent(data.id)}`, { state: { justPublished: true } });
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
  const stepNames=["Your idea","Your story","Ready to share"];
  const fld="mt-2 w-full min-h-12 rounded-2xl border border-white/20 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";
  const btn="ifund-interactive min-h-12 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50";
  const primary="ifund-interactive min-h-12 rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50";
  const next=(target)=>{
    if(step===0&&target===1&&!form.story.trim()&&draftDetails.trim()){
      setForm(previous=>previous.story.trim()?previous:{...previous,story:draftDetails.trim(),summary:previous.summary||draftDetails.trim().slice(0,SUMMARY_MAX)});
    }
    void advanceWizard(target);
  };
  return <main className="mx-auto w-full max-w-3xl px-3 py-4 pb-28 sm:px-6 sm:py-8" aria-label="Campaign creator">
    {busy === "active" && <CampaignLaunchProgress />}
    <section className={"relative mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-slate-950 text-white shadow-2xl "+(step===2?"ifund-eclipse-moment":"")}
      style={{backgroundImage:step===2?undefined:"radial-gradient(ellipse at 16% 5%,rgba(23,204,226,.19),transparent 43%),radial-gradient(ellipse at 88% 78%,rgba(178,82,226,.19),transparent 46%),repeating-linear-gradient(110deg,transparent,transparent 74px,rgba(170,210,255,.025) 75px,transparent 76px)"}}>
      <div className="relative space-y-5 px-5 py-6 sm:px-10 sm:py-10">
        <header className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">What If? · Campaign</p><span className="text-xs text-slate-300">{step+1} / 3</span></div>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold sm:text-3xl">{stepNames[step]}</h1>
          <p className="text-sm text-slate-300">{["Tell us a little. We'll help with the rest.","Your words are enough. Add extras only if you want.","Review it, then decide when to publish."][step]}</p>
          <nav aria-label="Campaign setup progress" className="pt-2"><ol className="grid grid-cols-3 gap-2">{WIZARD_STEPS.map((label,index)=>{const Icon=stepIcons[index];return <li key={label}><button type="button" title={label} aria-label={"Step "+(index+1)+": "+label}
            aria-current={step===index?"step":undefined} disabled={disabled||index>step} onClick={()=>next(index)}
            className={"flex min-h-12 w-full items-center justify-center rounded-xl border disabled:opacity-50 "+(step===index?"border-cyan-300 bg-cyan-300/20 text-cyan-100":"border-white/20 bg-white/[.05] text-slate-300")}><Icon size={20}/></button></li>})}</ol></nav>
        </header>
        {landingPrompt&&<p role="status" aria-label="Your starting idea" className="text-xs text-cyan-200">Your homepage idea is ready below.</p>}
        {!landingPrompt&&transferredPrompt&&<p role="status" className="text-xs text-amber-200">An existing draft was found, so your new idea was not merged.</p>}
        {templateParam&&<p role="status" className="text-xs text-cyan-200">Starting layout: {templateStyle(previewStyle).name}</p>}
        {wizardError&&<p role="alert" className="text-sm text-amber-200">{wizardError}</p>}
        {progressNotice&&<p role="status" className="text-xs text-slate-300">{progressNotice}</p>}
        {!storageReadable&&<div role="alert" className="space-y-2 text-sm"><p>Browser storage is unavailable. Saving is paused to protect your work.</p><button type="button" className={btn} onClick={retryStorageRead}>Retry storage</button></div>}
        {guestDecisionPending&&<div role="region" aria-label="Guest draft transfer" className="space-y-2 text-sm"><p>A guest draft was found on this device. Import only your own work; existing account drafts will not be overwritten.</p><div className="flex gap-2"><button type="button" className={btn} onClick={()=>decideGuestDraft(true)}>Import</button><button type="button" className={btn} onClick={()=>decideGuestDraft(false)}>Keep separate</button></div></div>}
        {guestImportMessage&&<div aria-live="polite" className="text-sm"><p>{guestImportMessage}</p>{guestCopyRetained && <button type="button" disabled={disabled||!ownerId} className={btn} onClick={retryGuestCopyCleanup}>Retry cleanup</button>}</div>}
        {loadingDraft && <p role="status">Loading draft…</p>}
        {draftLoadError&&<p role="alert" className="text-sm text-amber-200">{draftLoadError} <Link to="/campaigns" className="underline">My campaigns</Link></p>}
        <form id="campaign-editor" hidden={step===2} onSubmit={event => { event.preventDefault(); save("draft"); }} className="space-y-5">
          <fieldset disabled={disabled} className="space-y-5">
            {step===0&&<div className="space-y-5">
              <label className="block text-sm font-medium">Campaign name<input id="campaign-title" maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} placeholder="Give it a short name" className={fld}/></label>
              <label className="block text-sm font-medium">What are we making possible?<textarea rows={3} maxLength={1500} value={draftDetails} onChange={e=>changeWritingBrief(setDraftDetails,e.target.value)} placeholder="Tell us what you hope to accomplish…" className={fld}/></label>
              <CampaignVoiceInput value={draftDetails} onChange={value=>changeWritingBrief(setDraftDetails,value)} disabled={disabled}/>
              <label className="block text-sm font-medium">How much would help? (USD)<input id="campaign-goal" inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} placeholder="100" className={fld}/></label>
              <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">A little more context (optional)</summary>
                <div className="mt-3 space-y-4">
                  <label className="block text-sm">Who or what is this for?<input maxLength={100} value={draftBeneficiary} onChange={e=>changeWritingBrief(setDraftBeneficiary,e.target.value)} className={fld}/></label>
                  <label className="block text-sm">What resources or help would make this possible?<input maxLength={100} value={draftNeed} onChange={e=>changeWritingBrief(setDraftNeed,e.target.value)} className={fld}/></label>
                  <label className="block text-sm">Type of support<select id="campaign-support-type" value={supportType} onChange={e=>changeWritingBrief(setSupportType,e.target.value)} className={fld}>{SUPPORT_NEEDS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
                  {supportType!=="money"&&<p className="text-xs text-slate-300">For noncash help, <Link to="/what-if" className="underline">create a private Mission</Link> without a cash goal.</p>}
                  <label className="block text-sm">Category<select id="campaign-category" value={form.category} onChange={e=>change("category",e.target.value)} className={fld}>{CAMPAIGN_CATEGORIES.map(v=><option key={v} value={v}>{categoryLabels[v]||v}</option>)}</select></label>
                  <label className="block text-sm">What feeling should the story and images convey?<input maxLength={200} value={wizard.ai_profile.tone} onChange={e=>changeWritingPreference("tone",e.target.value)} className={fld}/></label>
                  <label className="block text-sm">Important facts to preserve<textarea rows={2} maxLength={2000} value={wizard.ai_profile.never_change} onChange={e=>changeWritingPreference("never_change",e.target.value)} className={fld}/></label>
                  <fieldset><legend className="text-sm">Writing style</legend>{CAMPAIGN_WRITING_PATHS.map(v=><label key={v.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="radio" name="writingPath" checked={writingPath===v.id} onChange={()=>changeWritingBrief(setWritingPath,v.id)}/>{v.title}</label>)}</fieldset>
                </div>
              </details>
              <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">Talk through it with NEXUS (optional)</summary>
                <CampaignVoiceGuide supportType={supportType} onDetails={v=>changeWritingBrief(setDraftDetails,v)} onBeneficiary={v=>changeWritingBrief(setDraftBeneficiary,v)}
                  onNeed={v=>changeWritingBrief(setDraftNeed,v)} onGoal={v=>change("goal_amount",v)} onStory={v=>change("story",v)} onTone={v=>changeWritingPreference("tone",v)} disabled={disabled}/>
              </details>
              <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">Already fundraising somewhere else? (optional)</summary><div className="mt-2 text-slate-900 dark:text-white"><ExternalCampaignHandoff form={form} disabled={disabled}/></div></details>
            </div>}
            {step===1&&<div className="space-y-5">
              <label className="block text-sm font-medium">Your story<textarea id="campaign-story" aria-label="Your story" maxLength={STORY_MAX} rows={5} value={form.story} onChange={e=>change("story",e.target.value)} placeholder="What should supporters know?" className={fld}/></label>
              <TrialCreationBalance compact />
              <PremiumOpportunity context="creator" compact />
              <button type="button" onClick={suggestDraft} disabled={suggesting||busy||loadingDraft||Boolean(draftLoadError)||draftDetails.trim().length<12} className={btn+" w-full"} title="Generate campaign ideas">{suggesting?"Preparing ideas…":"Help me write this with AI"}</button>
              {suggestionError&&<p role="alert" className="text-sm text-amber-200">{suggestionError} <Link to="/permissions" className="underline">AI permissions</Link></p>}
              {writingQueued&&<Link to="/agents" className="text-sm underline">View queued writing request</Link>}
              {suggestions&&<details open className="border-t border-white/10 pt-3"><summary className="cursor-pointer text-sm text-cyan-100">Review AI suggestions</summary><p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm">{suggestions.story}</p><button type="button" className={btn} onClick={()=>change("story",suggestions.story)}>Use suggested story</button>
                <details className="mt-3"><summary className="cursor-pointer text-sm">More titles and descriptions</summary>{suggestions.titles.map((v,i)=><div key={i} className="mt-2 flex items-center gap-2 text-sm"><span className="flex-1">{v}</span><button type="button" className={btn} onClick={()=>change("title",v)}>Use</button></div>)}{suggestions.summaries.map((v,i)=><div key={i} className="mt-2 flex items-center gap-2 text-sm"><span className="flex-1">{v}</span><button type="button" className={btn} onClick={()=>change("summary",v)}>Use</button></div>)}</details>
              </details>}
              <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">Add photo or illustration (optional)</summary>
                <div id="campaign-cover" className="mt-3 space-y-3">
                  <label className="block text-sm">Upload your photo<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void handleCoverUpload(file);}} className="mt-2 block w-full rounded-xl border border-white/20 p-3 text-sm"/></label>
                  {coverUploading&&<p role="status">Uploading photo…</p>}{coverUploadMessage&&<p role="status">{coverUploadMessage}</p>}
                  <div className="text-slate-900 dark:text-white"><CampaignImageChoices title={form.title} description={(form.summary||form.story||draftDetails).slice(0,900)} onApply={(url,provenance)=>{applyCampaignFields({cover_image_url:coverImageUrl(url),cover_image_is_ai:provenance?.cover_image_is_ai===true});setCoverUploadMessage("Your original iFund illustration is selected. Save your campaign draft to retain the cover.");}} disabled={disabled}/></div>
                  {form.cover_image_url&&<img src={form.cover_image_url} alt="Campaign cover preview" className="max-h-44 w-full rounded-xl object-contain"/>}
                  <details><summary className="cursor-pointer text-sm text-cyan-100">Use an image URL instead</summary><input id="campaign-cover-url" type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} onChange={e=>{const url=e.target.value;applyCampaignFields({cover_image_url:coverImageUrl(url),cover_image_is_ai:coverIsAI(url)});setCoverUploadMessage("");}} className={fld}/></details>
                </div>
              </details>
              <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">More editing tools (optional)</summary>
                <div className="mt-3 space-y-4"><label className="block text-sm">Short description<textarea id="campaign-summary" aria-label="Short description" rows={2} maxLength={SUMMARY_MAX} value={form.summary} onChange={e=>change("summary",e.target.value)} className={fld}/></label>
                  <div className="text-slate-900 dark:text-white"><CampaignDocuments key={(ownerId||"guest")+":"+(draftId||saved||campaignId.current||"new")} campaignId={draftId||saved||campaignId.current||null} ownerId={ownerId}/></div>
                  <div className="text-slate-900 dark:text-white"><WritingDraftReview onBusyChange={setHandoffBusy} ownerId={ownerId} campaignId={draftId||null} disabled={disabled} onApply={copy=>{applyCampaignFields(copy);setError("");}}/></div>
                  <div className="text-slate-900 dark:text-white"><AgentAdviceReview ownerId={ownerId} campaignId={draftId||null} currentStory={form.story} disabled={disabled} onBusyChange={setHandoffBusy} onApply={text => change("story",text)}/></div>
                  {storySections.length>0&&<><details aria-label="Story section editor"><summary className="cursor-pointer text-sm">Story sections</summary>{storySections.map((v,i)=><div key={i} className="mt-2"><textarea rows={3} value={v} onChange={e=>editSection(i,e.target.value)} className={fld}/><button type="button" className={btn} disabled={regeneratingSection!==-1||suggesting||busy} onClick={()=>regenerateSection(i)}>Suggest revision</button>{sectionProposals[i]&&<button type="button" className={btn} onClick={()=>editSection(i,sectionProposals[i])}>Use revision</button>}</div>)}{sectionError&&<p role="alert">{sectionError}</p>}</details></>}
                  {wizard.story_versions.length>0&&<details><summary>Previous story versions</summary>{wizard.story_versions.map((v,i)=><div key={i} className="mt-2"><p className="max-h-28 overflow-auto whitespace-pre-wrap text-sm">{v.text}</p><button type="button" className={btn} onClick={()=>change("story",v.text)}>Restore</button></div>)}</details>}
                </div>
              </details>
            </div>}
          </fieldset>
        </form>
        {step===2&&<div aria-label="Campaign launch review" className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-white/[.06] p-4">{form.cover_image_url&&<img src={form.cover_image_url} alt="Campaign cover" className="mb-3 max-h-44 w-full rounded-xl object-cover"/>}<h2 className="text-xl font-semibold">{form.title||"Your campaign"}</h2><p className="mt-2 text-sm">{form.summary||draftDetails||"Your campaign description"}</p>{Number(form.goal_amount)>0&&<p className="mt-3 text-sm font-semibold text-cyan-200">Goal: {"$"+Number(form.goal_amount).toLocaleString("en-US")}</p>}{form.story&&<details className="mt-3"><summary className="cursor-pointer text-sm text-cyan-100">Read full story</summary><p className="mt-2 whitespace-pre-wrap text-sm">{form.story}</p></details>}</div>
          <div id="campaign-publish-readiness" aria-live="polite" className="text-sm"><p className="font-semibold">{readiness.ready?"Ready to publish":"Before you publish"}</p>{!readiness.ready&&<ul className="mt-2 list-disc pl-5 text-amber-200">{readiness.missing.map(v=><li key={v}>{v}</li>)}</ul>}</div>
          <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer py-2 text-sm text-cyan-100">Preview or advanced settings (optional)</summary><div className="mt-3 space-y-4">
            <div className="flex gap-2"><button type="button" className={btn} onClick={()=>setPreviewViewport("mobile")}>Mobile</button><button type="button" className={btn} onClick={()=>setPreviewViewport("desktop")}>Desktop</button></div>
            <div className="text-slate-900 dark:text-white"><CampaignTemplatePreview template={previewStyle} category={form.category} content={form} viewport={previewViewport}/></div>
            <label className="block text-sm">Optional end date<input type="date" value={wizard.end_date||""} onChange={e=>changeWizard("end_date",e.target.value)} className={fld}/></label>
            <label className="block text-sm">Private location note<input maxLength={160} value={wizard.location} onChange={e=>changeWizard("location",e.target.value)} className={fld}/></label>
            <div className="text-slate-900 dark:text-white"><CampaignLocationFields form={form} change={change} disabled={disabled}/><AgentFeatureLauncher campaignId={ownerId?(draftId||saved||campaignId.current):null} disabled={disabled}/></div>
          </div></details>
          <p className="text-xs text-slate-300">Publishing does not require an AI review or a story-length target. You may improve your campaign afterward in Command Center.</p>
          <p className="text-xs text-slate-300">{donationsEnabled?"Publishing makes this active campaign eligible for verified PayPal donations.":"Campaign checkout is temporarily unavailable; you can still save and publish."}</p>
        </div>}
        {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
        {browserSaved&&<p role="status" className="text-xs text-slate-300">Draft saved in this browser tab only. It is not published.</p>}
        {saved&&!loadingDraft&&!draftLoadError&&<p role="status" className="text-xs text-cyan-200">{savedStatus==="active"?"Campaign published.":"Private draft saved."} <Link className="underline" to={savedStatus==="active"?"/campaign/"+encodeURIComponent(saved):"/create?draft="+encodeURIComponent(saved)}>View saved campaign</Link></p>}
        {autosaveError && <p role="alert" className="text-xs text-amber-200">{autosaveError}</p>}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4">
          <button type="button" className={btn} disabled={disabled||step===0} onClick={()=>next(step-1)}>Back</button>
          {step<2&&<button type="button" className={btn} disabled={disabled} onClick={()=>save("draft")}>Save draft</button>}
          {step<2&&<button type="button" className={primary} disabled={disabled} onClick={()=>next(step+1)}>Continue</button>}
          {step===2&&<button type="button" onClick={() => save("active")} className={primary+" flex-1"} disabled={disabled||!readiness.ready} aria-describedby="campaign-publish-readiness">{busy==="active"?"Publishing…":"Publish campaign"}</button>}
        </footer>
      </div>
    </section>
  </main>;
}
