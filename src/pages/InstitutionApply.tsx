/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function InstitutionApply() {
  const [institutionName, setInstitutionName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [type, setType] = useState("nonprofit");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitApplication = useMutation(api.institutions.submitApplication);

  const handleSubmit = async () => {
    if (!institutionName.trim() || !contactName.trim() || !contactEmail.trim() || !description.trim()) return;
    await submitApplication({
      institutionName,
      contactName,
      contactEmail,
      type,
      description,
      requestedAmount: parseFloat(requestedAmount) || 0,
    });
    setSubmitted(true);
    setInstitutionName("");
    setContactName("");
    setContactEmail("");
    setDescription("");
    setRequestedAmount("");
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="card text-center py-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-ifgreen/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <h3 className="text-sm font-bold text-iftext">Application Submitted!</h3>
          <p className="text-xs text-ifmuted">We'll review your application and get back to you within 5-7 business days.</p>
          <button onClick={() => setSubmitted(false)} className="btn-primary">Submit Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-iftext">Institution / Grant Application</h3>
      <p className="text-xs text-ifmuted">Apply for institutional funding or a grant from the Interplanetary Fund.</p>

      <div className="card space-y-3">
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Institution Name</label>
          <input type="text" placeholder="e.g. Community Health Initiative" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Contact Name</label>
          <input type="text" placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Contact Email</label>
          <input type="email" placeholder="you@institution.org" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Institution Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
            <option value="nonprofit">Nonprofit</option>
            <option value="school">School / Education</option>
            <option value="religious">Religious Organization</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Description</label>
          <textarea placeholder="Describe your institution and what the funding will be used for..." value={description} onChange={(e) => setDescription(e.target.value)} className="input-field min-h-[120px]" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted uppercase tracking-wide">Requested Amount ($)</label>
          <input type="number" placeholder="5000" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} className="input-field" />
        </div>
        <button onClick={handleSubmit} disabled={!institutionName.trim() || !contactName.trim() || !contactEmail.trim() || !description.trim()} className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold disabled:opacity-40">
          Submit Application
        </button>
      </div>
    </div>
  );
}
