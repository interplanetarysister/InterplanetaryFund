import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/ui/image";
import MediaUpload from "@/components/media/MediaUpload";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Megaphone, Loader2, Share2, Copy, Sparkles, Save } from "lucide-react";
import { generateCampaignUpdateDraft } from "@/lib/updateDraft";
import { copyText } from "@/lib/copyText";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function UpdatesSection({ campaign, campaignId = campaign?.id, updates, isOwner, onPosted }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const updateTextRef = useRef(null);
  const draftKey = `ifund:campaign-update-draft:${campaignId}`;
  const [mediaUrl, setMediaUrl] = useState("");
  const [crossPost, setCrossPost] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Keep unfinished update wording available if the owner leaves the page.
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved && typeof saved === "object") {
        setTitle(String(saved.title || ""));
        setContent(String(saved.content || ""));
        setNotes(String(saved.notes || ""));
        setMediaUrl(String(saved.mediaUrl || ""));
        setCrossPost(saved.crossPost !== false);
      } else { setTitle(""); setContent(""); setNotes(""); setMediaUrl(""); }
    } catch { /* Do not block the editor on a corrupt or disallowed storage key. */ }
  }, [draftKey]);

  useEffect(() => {
    try {
      // Deliberately local and private until Post update is explicitly clicked.
      // No accidental public publication when moving between steps.
      if (title || content || notes || mediaUrl) localStorage.setItem(draftKey, JSON.stringify({
        title, content, notes, mediaUrl, crossPost,
      }));
    } catch { /* still editable if local persistence is unavailable */ }
  }, [draftKey, title, content, notes, mediaUrl, crossPost]);

  const generate = () => {
    const draft = generateCampaignUpdateDraft(campaign || {id: campaignId}, notes);
    setTitle(draft.title);
    setContent(draft.content);
    setCopyStatus("Draft populated below. Edit it or copy before posting.");
  };

  const copy = async () => {
    const ok = await copyText(content, updateTextRef.current);
    setCopyStatus(ok ? "Update text copied." : "Copy was blocked. Update text is selected; use your device's Copy command.");
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ title, content, notes, mediaUrl, crossPost }));
      setCopyStatus("Private update draft saved on this device.");
    } catch {
      setCopyStatus("Could not save on this device. Your text is still in the editor.");
    }
  };

  const post = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { data } = await base44.functions.invoke("postCampaignUpdate", {
        campaign_id: campaignId,
        title,
        content,
        media_url: mediaUrl || undefined,
        media_type: mediaUrl ? (isVideo(mediaUrl) ? "video" : "image") : "none",
        cross_post: crossPost,
      });
      if (data?.error || !data?.update?.id) throw new Error("Update was not confirmed");
      else {
        const cp = data?.crosspost || {};
        const summary = crossPost && (cp.published || cp.pending || cp.drafts || cp.failed)
          ? ` Published ${cp.published} · ${cp.pending} awaiting approval · ${cp.drafts} draft${cp.drafts === 1 ? "" : "s"}${cp.failed ? ` · ${cp.failed} failed` : ""}. Notified ${data.followers_notified} follower${data.followers_notified === 1 ? "" : "s"}.`
          : ` Notified ${data.followers_notified || 0} follower${(data.followers_notified || 0) === 1 ? "" : "s"}.`;
        toast({ title: "Update posted", description: summary,
          actionContext: { campaignId, action: "post update" }, actionLabel: "View campaign updates" });
        // Clear the author's draft only after the server confirms persistence.
        try { localStorage.removeItem(draftKey); } catch {}
        setTitle(""); setContent(""); setNotes(""); setMediaUrl("");
        setCopyStatus("Update posted successfully.");
        onPosted?.();
      }
    } catch (e) {
      console.error("Campaign update failed:", e?.name || "UnknownError");
      toast({ title: "Couldn't post update", description: "The update could not be posted safely. Please try again.", variant: "destructive",
          actionContext: { campaignId, action: "post update" }, actionLabel: "Return to updates" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Megaphone className="w-4 h-4 text-primary" />
        <h3 className="font-display text-xl text-stone-900">Updates</h3>
      </div>
      {isOwner && (
        <div className="space-y-3 mb-6 pb-6 border-b border-stone-100">
          <p className="text-xs text-stone-600">Create an update you can review, edit, copy, save privately, or post. Nothing is published until you choose Post update.</p>
          <Input value={notes} onChange={e => setNotes(e.target.value)}
            className="bg-white text-stone-950 placeholder:text-stone-500"
            placeholder="What happened? Optional notes for the draft generator" />
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={generate}>
            <Sparkles className="w-4 h-4" /> Generate copy-ready update
          </Button>
          <Input className="bg-white text-stone-950 placeholder:text-stone-500 caret-stone-950" placeholder="Update title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea ref={updateTextRef} className="bg-white text-stone-950 placeholder:text-stone-500 caret-stone-950" placeholder="Generate text above or write your update here…" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!content.trim()} onClick={copy}>
              <Copy className="w-4 h-4" /> Copy update text
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={saveDraft}>
              <Save className="w-4 h-4" /> Save private draft
            </Button>
            {copyStatus && <span role="status" className="text-xs text-stone-600">{copyStatus}</span>}
          </div>
          <MediaUpload
            value={mediaUrl}
            onChange={setMediaUrl}
            label="Attach a photo or video"
            previewClassName="w-full max-h-80 rounded-xl object-contain bg-stone-100"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <Checkbox checked={crossPost} onCheckedChange={setCrossPost} />
            <Share2 className="w-3.5 h-3.5 text-stone-400" />
            Cross-post to connected platforms (AI per your automation settings)
          </label>
          <Button onClick={post} disabled={saving || !content.trim()} className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post update"}
          </Button>
        </div>
      )}
      {updates.length === 0 ? (
        <p className="text-sm text-stone-400">No updates yet.</p>
      ) : (
        <div className="space-y-5">
          {updates.map((u) => (
            <div key={u.id}>
              <p className="text-xs text-stone-400 mb-1">{format(new Date(u.created_date), "MMM d, yyyy")}</p>
              {u.title && <h4 className="font-semibold text-stone-900 mb-1">{u.title}</h4>}
              {u.media_url && (isVideo(u.media_url) ? (
                <video src={u.media_url} controls className="w-full max-h-80 rounded-xl mb-3" />
              ) : (
                <Image src={u.media_url} alt={u.title || "Update media"} className="w-full max-h-[32rem] rounded-xl object-contain bg-stone-100 mb-3" />
              ))}
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{u.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}