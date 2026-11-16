import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
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
import { CAMPAIGN_CATEGORIES, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX, validateCampaignForm, publishReadiness } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import MemberAccess from "@/components/auth/MemberAccess";
import { useAuthSession } from "@/hooks/useAuthSession";
import { restoreBrowserCampaign, restoreWritingBrief, emptyWritingBrief, rememberBrowserCampaign, forgetBrowserCampaign, hasUnclaimedGuestCampaign, importGuestCampaign } from "@/lib/browserCampaignDraft";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";
import PrepublicationGate from "@/components/campaigns/PrepublicationGate";
import CampaignReadinessScore from "@/components/campaigns/CampaignReadinessScore";
import CampaignLocationFields from "@/components/atlas/CampaignLocationFields";
import ExternalCampaignHandoff from "@/components/campaigns/ExternalCampaignHandoff";
import CampaignDocuments from "@/components/campaigns/CampaignDocuments";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";

export default function CreateCampaign() {
  const [params] = useSearchParams();
  const draftId = params.get("draft");
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
  const [params] = useSearchParams();
  const draftId = params.get("draft");
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
        if (data.status !== "draft") throw new Error("This campaign is no longer a draft. Open My campaigns to view its current status.");
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
          const sections=splitStory(data.story || "");
          storySectionsRef.current=sections;setStorySections(sections);
          setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:Number(data.goal_amount)>0 ? String(data.goal_amount) : "", cover_image_url:data.cover_image_url||"", map_opt_in:data.map_opt_in===true, public_location_label:data.public_location_label||"", map_latitude:data.map_latitude===null ? "" : String(data.map_latitude), map_longitude:data.map_longitude===null ? "" : String(data.map_longitude) });
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
      if (!draftId) return restoreBrowserCampaign(sessionStorage, ownerId);
    } catch { /* session storage unavailable */ }
    return { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "", map_opt_in: false, public_location_label: "", map_latitude: "", map_longitude: "" };
  });
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState("");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [savedStatus, setSavedStatus] = useState("draft");
  const [browserSaved, setBrowserSaved] = useState(false);
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
    try { return draftId ? emptyWritingBrief() : restoreWritingBrief(sessionStorage, ownerId); }
    catch { return emptyWritingBrief(); }
  });
  const [writingPath, setWritingPath] = useState(restoredBrief.writingPath);
  const [draftDetails, setDraftDetails] = useState(restoredBrief.details);
  const [draftBeneficiary, setDraftBeneficiary] = useState(restoredBrief.beneficiary);
  const [draftNeed, setDraftNeed] = useState(restoredBrief.need);
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
      setGuestImportMessage(outcome.status === "imported_guest_retained" ? "Draft imported, but the guest copy could not be removed from this device. Private information may remain accessible to another guest. Avoid using this shared device until its browser data is cleared." : "Guest draft imported into this account.");
      setGuestDecisionPending(false);
    } catch {
      setGuestImportMessage("Browser storage failed. Guest draft was not intentionally deleted. Choose Keep separate.");
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
    return campaignSetupPayload({...wizard,writing_brief:{wizard_version:2,writingPath,details:draftDetails,beneficiary:draftBeneficiary,need:draftNeed}},nextStep);
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
    if(disabled||saveLock.current||next<0||next>3)return;
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
      change("cover_image_url", url);
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
      if(status==="active")await saveOwnerCampaign(client,form,{id:data.id,status:"active",expectedStatus:"draft",scope});
      if(!alive.current)return false;
      setSavedStatus(status);setProgressNotice("Campaign and setup progress saved to your account.");
      storyEditStarted.current=false;
      // A server save succeeded, but local cleanup can fail (disabled storage,
      // malformed legacy data, or a blocked removeItem). Do not report that
      // the browser copy was removed unless cleanup actually succeeded.
      let browserCleanupFailed = false;
      try {
        const cleared = forgetBrowserCampaign(sessionStorage, ownerId);
        const wizardCleared=forgetWizard(sessionStorage,ownerId,null)&&forgetWizard(sessionStorage,ownerId,data.id)&&clearPendingCampaignSetup(sessionStorage,ownerId,data.id);
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
  const actions = <div className="flex flex-wrap gap-3">
    <button form="campaign-editor" type="submit" disabled={disabled} className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save draft"}</button>
    {step===2&&<button type="button" onClick={() => save("active")} disabled={disabled || !readiness.ready} aria-describedby="campaign-publish-readiness" className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy === "active" ? "Publishing…" : "Publish campaign"}</button>}
  </div>;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold">Create a campaign · {WIZARD_STEPS[step]}</h1><p className="mt-2 text-muted-foreground">Explore the campaign creator without identity verification. Guest drafts stay in this browser. Sign in with a verified email account to save a campaign to your account or publish it.</p><div className="mt-3 flex flex-wrap items-center gap-4"><Link to="/campaigns" className="underline">My campaigns</Link><Link to="/fundraising-partners" className="font-semibold text-primary underline">Use iFund to prepare for another fundraising platform</Link></div></header>
    <nav aria-label="Campaign setup progress"><ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">{WIZARD_STEPS.map((label,index)=><li key={label} aria-current={step===index?"step":undefined}><button type="button" disabled={disabled||index>step} onClick={()=>advanceWizard(index)} className={"min-h-12 w-full rounded-xl border p-3 text-sm "+(step===index?"border-primary bg-primary/10 font-semibold":"border-border")}>{index+1}. {label}</button></li>)}</ol></nav>
    <AgentFeatureLauncher campaignId={ownerId?(draftId||saved||campaignId.current):null} disabled={disabled} />
    {wizardError&&<p role="alert" className="rounded-xl border border-destructive p-4">{wizardError}</p>}
    {progressNotice&&<p role="status" className="text-sm text-muted-foreground">{progressNotice}</p>}
    {!storageReadable && <section role="alert" className="rounded-xl border border-destructive p-4 space-y-2">
      <p>{draftId?"Browser draft storage could not be read. Your account draft can still be saved; a device copy may remain until storage is available.":"Browser draft storage could not be read. Saving is paused to protect any existing private draft. Copy your work before leaving this page."}</p>
      <button type="button" onClick={retryStorageRead} className="min-h-12 rounded-xl border border-border px-4 font-semibold">Retry browser storage</button>
    </section>}
    {guestDecisionPending && <section role="region" aria-label="Guest draft transfer" className="space-y-3 rounded-xl border p-3"><p>A guest campaign draft is stored on this device and may belong to another person. Import it only if it is yours. Existing account drafts will not be overwritten.</p><div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded border px-3" onClick={() => decideGuestDraft(true)}>Import my guest draft</button><button type="button" className="min-h-11 rounded border px-3" onClick={() => decideGuestDraft(false)}>Keep separate</button></div></section>}
    {guestImportMessage && <p role="status" className="text-sm break-words">{guestImportMessage}</p>}
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError} <Link to="/campaigns" className="underline">My campaigns</Link></p>}
    <div hidden={step!==0}><ExternalCampaignHandoff form={form} disabled={privacyDecisionPending || loadingDraft || Boolean(draftLoadError) || (draftId && loadedDraftId !== draftId)} /></div>
    <div hidden={step!==1}><CampaignDocuments key={(ownerId||"guest")+":"+(draftId||saved||campaignId.current||"new")} campaignId={draftId||saved||campaignId.current||null} ownerId={ownerId} /></div>
    <div hidden={step!==1}><WritingDraftReview onBusyChange={setHandoffBusy} ownerId={ownerId} campaignId={draftId || null} disabled={disabled} onApply={copy => { applyCampaignFields(copy); setError(""); }} /></div>
    <section hidden={step!==0&&step!==1} className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-label="Campaign writing assistant">
      <fieldset disabled={disabled} className="space-y-4">
      <div hidden={step!==0} className="space-y-4">
      <h2 className="text-xl font-semibold">Your campaign details</h2>
      <label className="block font-semibold">Working campaign title
        <input id="campaign-working-title" maxLength={TITLE_MAX} value={form.title} onChange={event=>change("title",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <p className="text-sm text-muted-foreground">Add a working title to save these answers as a private account draft. You can change it as you build your campaign.</p>
      <fieldset className="space-y-3">
        <legend className="font-semibold">What kind of campaign are you creating?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAMPAIGN_WRITING_PATHS.map(path => <label key={path.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${writingPath === path.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="radio" name="writingPath" value={path.id} checked={writingPath === path.id} onChange={() => changeWritingBrief(setWritingPath, path.id)} disabled={busy || loadingDraft} />
            <span>{path.title}</span>
          </label>)}
        </div>
        <p className="text-sm text-muted-foreground">Choose a starting direction. Generate five title ideas, two short descriptions and one editable story.</p>
      </fieldset>
      <p className="text-sm text-muted-foreground">Get writing suggestions, check the facts, and choose what to include in your campaign. Your setup answers, writing preferences and progress are saved privately with your campaign when you save your account draft. Apply the suggestions you want to keep to your campaign title, description, or story before leaving.</p>
      <label className="block font-semibold">What is your fundraiser about?
        <textarea rows={4} maxLength={1500} value={draftDetails} disabled={busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => changeWritingBrief(setDraftDetails, e.target.value)} placeholder="Describe the situation and how funds would help."
          className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Who benefits? (optional)
        <input maxLength={100} value={draftBeneficiary} disabled={busy}
          onChange={e => changeWritingBrief(setDraftBeneficiary, e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">What is needed? (optional)
        <input maxLength={100} value={draftNeed} disabled={busy}
          onChange={e => changeWritingBrief(setDraftNeed, e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">Preferred writing tone<input maxLength={200} value={wizard.ai_profile.tone} onChange={event=>changeWritingPreference("tone",event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" placeholder="For example: clear, warm and practical" /></label>
      <label className="block font-semibold">Facts or wording to preserve<textarea maxLength={2000} rows={4} value={wizard.ai_profile.never_change} onChange={event=>changeWritingPreference("never_change",event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <p className="text-sm text-muted-foreground">Writing preferences guide proposed copy. They never authorize publishing, messages or financial actions.</p>
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
    <form hidden={step===2} id="campaign-editor" onSubmit={event => { event.preventDefault(); save("draft"); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <fieldset disabled={disabled} className="space-y-5">
      <div hidden={step!==0} className="space-y-5"><label className="block font-semibold">Campaign title<input id="campaign-title" maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      </div><div hidden={step!==1} className="space-y-5"><label className="block font-semibold">Short description (optional)<textarea id="campaign-summary" aria-label="Short description" maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <p className="text-sm text-muted-foreground">Write as much or as little as you need. There is no minimum story length or required paragraph format.</p>
      <label className="block font-semibold">Your story<textarea id="campaign-story" aria-label="Your story" maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      </div><div hidden={step!==0} className="space-y-5"><label className="block font-semibold">Category<select id="campaign-category" value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input id="campaign-goal" inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
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
        {coverUploadMessage && <p role="status" className="text-sm text-emerald-700">{coverUploadMessage}</p>}
        <label className="block text-sm font-semibold">Or paste an image URL
          <input id="campaign-cover-url" type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url}
            onChange={event => { change("cover_image_url",event.target.value); setCoverUploadMessage(""); }}
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
    <div hidden={step!==2}><CampaignReadinessScore form={form} /></div>
    {autosaveError && <div role="alert" className="space-y-2 text-sm text-destructive break-words"><p>{autosaveError}</p>{saved && <Link className="inline-block underline font-semibold" to={savedStatus==="active"?`/campaign/${encodeURIComponent(saved)}`:`/create?draft=${encodeURIComponent(saved)}`}>View saved campaign</Link>}</div>}
    <div hidden={step!==2}><PrepublicationGate form={form} campaignId={draftId || saved || null} disabled={disabled} onApply={value=>change("story", value)} onApplyFields={applyCampaignFields} onFocusField={focusCampaignField} /></div>
    <section hidden={step!==2} aria-label="Save or publish campaign" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
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
