/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type VolunteerProps = {
  userId: string;
  userName: string;
};

export default function Volunteer({ userId, userName }: VolunteerProps) {
  const [selectedOpp, setSelectedOpp] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  const opportunities = useQuery(api.volunteer.getOpportunities, {});
  const mySignups = useQuery(api.volunteer.getMySignups, { userId });
  const signUp = useMutation(api.volunteer.signUp);

  const handleSignUp = async () => {
    if (!selectedOpp || !signupEmail.trim()) return;
    await signUp({
      opportunityId: selectedOpp,
      userId,
      userName,
      userEmail: signupEmail,
      message: signupMessage || undefined,
    });
    setSignupSuccess(true);
    setSignupMessage("");
    setSignupEmail("");
    setShowSignup(false);
  };

  const hasSignedUp = (oppId: string) => {
    return mySignups?.some((s: any) => s.opportunityId === oppId) ?? false;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-iftext">Volunteer Opportunities</h3>
      <p className="text-xs text-ifmuted">Lend your time and skills to campaigns that need help.</p>

      {/* My signups */}
      {mySignups && mySignups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-ifmuted uppercase tracking-wide">Your Signups</p>
          {mySignups.map((s: any) => (
            <div key={s._id} className="card flex items-center justify-between">
              <p className="text-xs text-iftext">{s.userName}</p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                s.status === "accepted" ? "bg-ifgreen/20 text-ifgreen" :
                s.status === "declined" ? "bg-red-500/20 text-red-400" :
                "bg-ifamber/20 text-ifamber"
              }`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* All opportunities */}
      <div className="space-y-3">
        <p className="text-[10px] text-ifmuted uppercase tracking-wide">Open Opportunities</p>
        {!opportunities && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {opportunities && opportunities.length === 0 && (
          <div className="card text-center py-6">
            <p className="text-xs text-ifmuted">No volunteer opportunities yet. Check back soon!</p>
          </div>
        )}
        {opportunities?.map((o: any) => (
          <div key={o._id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-iftext">{o.title}</p>
              <span className="px-2 py-0.5 rounded-full bg-ifcyan/20 text-ifcyan text-[10px]">{o.location}</span>
            </div>
            <p className="text-xs text-ifmuted">{o.description}</p>
            <div className="flex flex-wrap gap-1">
              {o.skills?.map((skill: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-ifaccent/10 text-ifaccent text-[10px]">{skill}</span>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-ifmuted">
              <span>{o.timeCommitment}</span>
              <span>{o.currentVolunteers}/{o.maxVolunteers} volunteers</span>
            </div>
            <div className="w-full h-1 bg-ifborder rounded-full overflow-hidden">
              <div className="h-full bg-ifcyan rounded-full" style={{ width: `${Math.min(100, (o.currentVolunteers / o.maxVolunteers) * 100)}%` }} />
            </div>
            {hasSignedUp(o._id) ? (
              <div className="w-full py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs font-medium text-center">
                ✓ Signed Up
              </div>
            ) : (
              <button
                onClick={() => { setSelectedOpp(o._id); setShowSignup(true); setSignupSuccess(false); }}
                className="w-full py-2 rounded-lg bg-ifaccent text-white text-xs font-semibold"
              >
                Volunteer
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Signup modal */}
      {showSignup && selectedOpp && (
        <div className="fixed inset-0 z-50 bg-ifdark/90 backdrop-blur flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-3">
            {signupSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-ifgreen/20 flex items-center justify-center mx-auto">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-sm font-bold text-iftext">You're signed up!</p>
                <p className="text-xs text-ifmuted">The campaign organizer will be in touch soon.</p>
                <button onClick={() => { setShowSignup(false); setSelectedOpp(null); setSignupSuccess(false); }} className="btn-primary w-full">Done</button>
              </div>
            ) : (
              <>
                <h4 className="text-sm font-bold text-iftext">Volunteer Sign Up</h4>
                <div>
                  <label className="text-[10px] text-ifmuted uppercase tracking-wide">Email</label>
                  <input type="email" placeholder="you@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="text-[10px] text-ifmuted uppercase tracking-wide">Message (optional)</label>
                  <textarea placeholder="Why do you want to help?" value={signupMessage} onChange={(e) => setSignupMessage(e.target.value)} className="input-field min-h-[60px]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSignUp} disabled={!signupEmail.trim()} className="btn-primary flex-1">Submit</button>
                  <button onClick={() => { setShowSignup(false); setSelectedOpp(null); }} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
