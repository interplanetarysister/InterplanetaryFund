import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, HandHeart, MapPin, Clock, Check } from "lucide-react";

export default function VolunteerTab({ community, isMember, canManage }) {
  const [opportunities, setOpportunities] = useState(null);
  const [mySignups, setMySignups] = useState([]);
  const [userId, setUserId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ role_title: "", description: "", skills_needed: "", location: "", schedule: "", estimated_hours: "", remote_ok: false });
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUserId(me.id);
      const [opps, signups] = await Promise.all([
        base44.entities.VolunteerOpportunity.filter({ community_id: community.id }, "-created_date"),
        base44.entities.VolunteerSignup.filter({ community_id: community.id, user_id: me.id }),
      ]);
      setOpportunities(opps);
      setMySignups(signups.map((s) => s.opportunity_id));
    })();
  }, [community.id]);

  const publish = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("createVolunteerOpportunity", { ...form, community_id: community.id });
    const opp = data?.opportunity;
    if (!opp) { setSaving(false); return; }
    setOpportunities((prev) => [opp, ...(prev || [])]);
    setForm({ role_title: "", description: "", skills_needed: "", location: "", schedule: "", estimated_hours: "", remote_ok: false });
    setShowForm(false);
    setSaving(false);
  };

  const signUp = async (opp) => {
    setJoining(opp.id);
    const { data } = await base44.functions.invoke("volunteerSignup", { opportunity_id: opp.id });
    if (data?.signup) {
      setMySignups((prev) => [...prev, opp.id]);
      setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, volunteer_count: (o.volunteer_count || 0) + 1 } : o)));
    } else if (data?.error) {
      alert("The volunteer signup could not be completed. Please try again.");
    }
    setJoining(null);
  };

  if (!opportunities) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {canManage && !showForm && (
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          <HandHeart className="w-4 h-4" /> Publish opportunity
        </Button>
      )}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
          <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Role title (e.g. Event Photographer)" />
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will volunteers do?" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={form.skills_needed} onChange={(e) => setForm({ ...form, skills_needed: e.target.value })} placeholder="Skills needed" />
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" />
            <Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Schedule (e.g. Saturdays)" />
            <Input value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} placeholder="Estimated hours" />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <Checkbox checked={form.remote_ok} onCheckedChange={(v) => setForm({ ...form, remote_ok: !!v })} /> Remote-friendly
          </label>
          <div className="flex gap-2">
            <Button onClick={publish} disabled={saving || !form.role_title} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {opportunities.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No volunteer opportunities yet.</p>
      ) : (
        opportunities.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{o.role_title}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-stone-500">
                  {o.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {o.location}</span>}
                  {o.schedule && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {o.schedule}</span>}
                  {o.remote_ok && <Badge variant="secondary">Remote OK</Badge>}
                </div>
              </div>
              <Badge variant="outline" className={o.status === "open" ? "text-emerald-700 border-emerald-200" : "text-stone-500"}>
                {o.status}
              </Badge>
            </div>
            {o.description && <p className="text-sm text-stone-600 mt-2">{o.description}</p>}
            {o.skills_needed && <p className="text-xs text-stone-500 mt-1.5"><span className="font-semibold">Skills:</span> {o.skills_needed}</p>}
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-stone-400">{o.volunteer_count || 0} volunteer{(o.volunteer_count || 0) === 1 ? "" : "s"} signed up</p>
              {mySignups.includes(o.id) ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Signed up</span>
              ) : (
                isMember && o.status === "open" && o.created_by_id !== userId && (
                  <Button size="sm" onClick={() => signUp(o)} disabled={joining === o.id} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">
                    {joining === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "I'm interested"}
                  </Button>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}