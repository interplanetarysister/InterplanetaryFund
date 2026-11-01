import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { opportunityCategories } from "./institutionTypes";

const empty = { title: "", category: "grant", description: "", award_amount: "", eligibility: "", requirements: "", deadline: "" };

export default function PublishOpportunityForm({ institution, onCreated, onCancel }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const publish = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("publishInstitutionOpportunity", {
      ...form,
      deadline: form.deadline || undefined,
      institution_id: institution.id,
    });
    if (data?.opportunity) {
      onCreated(data.opportunity);
    } else if (data?.error) {
      alert("The opportunity could not be published. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Community Health Micro-Grant" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(opportunityCategories).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is offered and what it supports" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Award / value</Label>
          <Input value={form.award_amount} onChange={(e) => set("award_amount", e.target.value)} placeholder="e.g. Up to $10,000" />
        </div>
        <div className="space-y-1.5">
          <Label>Deadline</Label>
          <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Eligibility</Label>
        <Textarea rows={2} value={form.eligibility} onChange={(e) => set("eligibility", e.target.value)} placeholder="Who can apply" />
      </div>
      <div className="space-y-1.5">
        <Label>Requirements</Label>
        <Textarea rows={2} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} placeholder="Documents, reporting, or other requirements" />
      </div>
      <div className="flex gap-2">
        <Button onClick={publish} disabled={saving || !form.title} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
        </Button>
        <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
      </div>
    </div>
  );
}