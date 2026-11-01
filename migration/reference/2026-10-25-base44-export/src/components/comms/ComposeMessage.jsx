import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { templates } from "./templates";
import { secureInvokeLLM } from "@/lib/secureLLM";

const commTypes = [
  { value: "update", label: "Campaign Update" },
  { value: "thank_you", label: "Thank You" },
  { value: "announcement", label: "Announcement" },
  { value: "milestone", label: "Milestone" },
];

const audiences = [
  { value: "campaign_donors", label: "Donors of selected campaign" },
  { value: "all_donors", label: "All my donors" },
  { value: "recurring_donors", label: "Recurring donors" },
];

export default function ComposeMessage({ onSent }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("all");
  const [commType, setCommType] = useState("update");
  const [audience, setAudience] = useState("campaign_donors");
  const [channels, setChannels] = useState(["email", "in_app"]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.auth.me().then((me) =>
      base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date").then(setCampaigns)
    );
  }, []);

  const applyTemplate = async (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const me = await base44.auth.me();
    setSubject(t.subject);
    setContent(t.content.replace("{{your_name}}", me.full_name || ""));
    setCommType(t.comm_type);
    setAiGenerated(false);
  };

  const toggleChannel = (ch) =>
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));

  const draftWithAI = async () => {
    setDrafting(true);
    setError("");
    const campaign = campaigns.find((c) => c.id === campaignId);
    const res = await secureInvokeLLM({
      task: `Act as a fundraising communications expert. Write a warm, genuine ${commTypes.find((t) => t.value === commType)?.label || "campaign update"} from a campaign organizer to donors. Keep it under 150 words, plain text, with no placeholder brackets. Do not invent facts.`,
      untrusted: campaign ? [{ label: "campaign", value: JSON.stringify({ title: campaign.title, summary: campaign.summary || "n/a", raised: campaign.raised_amount || 0, goal: campaign.goal_amount, donors: campaign.donor_count || 0 }) }] : [],
      trustedContext: campaign ? "Draft for the supplied campaign record." : "Draft covers all of the organizer's campaigns; no campaign-specific facts were supplied.",
      response_json_schema: {
        type: "object",
        properties: { subject: { type: "string" }, content: { type: "string" } },
      },
    });
    setSubject(res.subject || "");
    setContent(res.content || "");
    setAiGenerated(true);
    setDrafting(false);
  };

  const send = async () => {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("sendCommunication", {
        campaign_id: campaignId === "all" ? null : campaignId,
        subject,
        content,
        comm_type: commType,
        audience: campaignId === "all" ? "all_donors" : audience,
        channels,
        ai_generated: aiGenerated,
      });
      setResult(data);
      setSubject("");
      setContent("");
      onSent?.();
    } catch (e) {
      console.error("Message send failed:", e?.name || "UnknownError");
      setError("Sending failed. Please try again.");
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Campaign</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my campaigns</SelectItem>
              {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Message type</Label>
          <Select value={commType} onValueChange={setCommType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {commTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Audience</Label>
          <Select value={campaignId === "all" ? "all_donors" : audience} onValueChange={setAudience} disabled={campaignId === "all"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {audiences.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Start from a template</Label>
          <Select onValueChange={applyTemplate}>
            <SelectTrigger><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Subject</Label>
          <Button variant="outline" size="sm" onClick={draftWithAI} disabled={drafting} className="text-primary border-primary/20 hover:bg-primary/10">
            {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Draft with AI
          </Button>
        </div>
        <Input value={subject} onChange={(e) => { setSubject(e.target.value); setAiGenerated(false); }} placeholder="Message subject" />
      </div>

      <div className="space-y-1.5">
        <Label>Message</Label>
        <Textarea rows={8} value={content} onChange={(e) => { setContent(e.target.value); setAiGenerated(false); }} placeholder="Write your message…" />
        {aiGenerated && <p className="text-xs text-stone-400">AI-drafted — review before sending.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <Label className="text-stone-500">Deliver via:</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={channels.includes("email")} onCheckedChange={() => toggleChannel("email")} /> Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={channels.includes("in_app")} onCheckedChange={() => toggleChannel("in_app")} /> In-app notification
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="text-sm rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-emerald-800">
          Sent to {result.recipients} supporter{result.recipients === 1 ? "" : "s"} — {result.emails} email{result.emails === 1 ? "" : "s"}, {result.in_app} in-app notification{result.in_app === 1 ? "" : "s"}.
        </p>
      )}

      <Button onClick={send} disabled={sending || !subject || !content || channels.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-6">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send message
      </Button>
      <p className="text-xs text-stone-400">Emails reach supporters registered on Interplanetary Fund. Recipient consent preferences are always respected.</p>
    </div>
  );
}