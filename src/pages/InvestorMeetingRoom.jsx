import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loading } from "../components/UI";
import { Video, Shield, CheckCircle, ChevronLeft, ChevronRight, MessageSquare, Send, FileText } from "lucide-react";

export default function InvestorMeetingRoom() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputQ, setInputQ] = useState("");
  const [sendingQ, setSendingQ] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!token) {
        setError("Meeting access token is missing. Please use your personalized invitation link.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/investor-meeting/session?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.ok) {
          setSession(data);
          setChatMessages([
            {
              role: "assistant",
              content: `Welcome to the Interplanetary Fund Strategic Briefing. I am Michelle Rogers, Director of Strategic Partnerships & Capital Development. Please review the briefing slides and feel free to ask questions regarding our business model, unit economics, and capital allocation.`
            }
          ]);
        } else {
          setError(data.message || "Failed validating meeting token.");
        }
      } catch (err) {
        setError("Connection error accessing investor meeting room.");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [token]);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!inputQ.trim() || sendingQ) return;

    const q = inputQ.trim();
    setInputQ("");
    setChatMessages(prev => [...prev, { role: "user", content: q }]);
    setSendingQ(true);

    try {
      const res = await fetch("/api/executive/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      if (data.ok && data.reply) {
        let textContent = "";
        if (data.reply.structure === "minto_pyramid_principle") {
          textContent = `**Direct Answer:** ${data.reply.level_1_core_conclusion}\n\n` +
            data.reply.level_2_supporting_arguments.map(p => `• **${p.title}:** ${p.argument}`).join("\n") +
            `\n\n**Risk Management:**\n` +
            data.reply.level_3_risk_mitigation_and_hedges.map(h => `• ${h.tradeoff}: ${h.proactive_mitigation}`).join("\n");
        } else if (data.reply.step_1_acknowledge) {
          textContent = `${data.reply.step_1_acknowledge}\n\n${data.reply.step_3_evidence}\n\n${data.reply.step_4_redirect}`;
        } else {
          textContent = data.reply.message || "Thank you for the inquiry.";
        }
        setChatMessages(prev => [...prev, { role: "assistant", content: textContent }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error transmitting inquiry." }]);
    } finally {
      setSendingQ(false);
    }
  };

  if (loading) return <Loading />;

  if (error) {
    return (
      <main style={{ maxWidth: "600px", margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
        <Shield size={48} color="#ef4444" style={{ marginBottom: "1rem" }} />
        <h1>Investor Briefing Access Required</h1>
        <p style={{ color: "var(--muted, #888)", marginBottom: "1.5rem" }}>{error}</p>
        <Link to="/" style={{ color: "var(--accent, #3b82f6)" }}>Return to Interplanetary Fund</Link>
      </main>
    );
  }

  const slides = session?.slides || [];
  const currentSlide = slides[currentSlideIndex] || { title: "Executive Overview" };

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Meeting Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border, #333)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{session?.title}</h1>
            <span style={{ fontSize: "0.75rem", background: "#16a34a", color: "#fff", padding: "0.2rem 0.5rem", borderRadius: "10px" }}>Live Briefing</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted, #888)", marginTop: "0.25rem" }}>
            Host: {session?.host?.name} · {session?.host?.title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={e => setConsentGiven(e.target.checked)}
            />
            Recording & AI Transcription Consent
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.5rem" }}>
        {/* Presentation Slide View */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{
            background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
            borderRadius: "8px",
            border: "1px solid var(--border, #333)",
            height: "460px",
            padding: "2.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative"
          }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--accent, #38bdf8)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>
                SLIDE {currentSlideIndex + 1} OF {slides.length}
              </div>
              <h2 style={{ fontSize: "1.8rem", margin: "0.5rem 0 1rem" }}>{currentSlide.title}</h2>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", fontSize: "1.1rem", lineHeight: "1.6", color: "#e4e4e7" }}>
              {currentSlideIndex === 0 && (
                <p>Welcome to Interplanetary Fund's institutional investor briefing. We are presenting our 18–24 month capital plan to raise $450,000 across a balanced allocation of strategic partners, angel syndicates, non-dilutive grants, and corporate sponsorships.</p>
              )}
              {currentSlideIndex === 1 && (
                <p><strong>The Bleeding-Neck Problem:</strong> Existing platforms impose exorbitant 8–10% take rates, fragmented attribution, and high donor drop-off. Startups and social impact campaigns lose billions in transactional leakage.</p>
              )}
              {currentSlideIndex === 2 && (
                <p><strong>The Solution:</strong> Interplanetary Fund provides partner-first social impact infrastructure. We empower campaigns with zero upfront platform fees, persistent verified attribution, and AI-powered donor intelligence.</p>
              )}
              {currentSlideIndex === 3 && (
                <p><strong>Bottom-Up TAM:</strong> Algorithmic market sizing targeting $2.4B SAM across early-stage technology startups, creative crowdfunders, and institutional grant seekers.</p>
              )}
              {currentSlideIndex === 4 && (
                <p><strong>Hamilton Helmer 7 Powers Moats:</strong> Strong counter-positioning against legacy high-fee platforms, high switching costs through integrated community trust, and organic viral referral loops.</p>
              )}
              {currentSlideIndex === 5 && (
                <p><strong>Capital Asks & Milestones:</strong> $450,000 round providing 24 months of operational runway to achieve $1.2M ARR run-rate and tier-1 Series A readiness.</p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #27272a", paddingTop: "1rem" }}>
              <button
                disabled={currentSlideIndex === 0}
                onClick={() => setCurrentSlideIndex(i => Math.max(0, i - 1))}
                style={{
                  background: "transparent",
                  color: currentSlideIndex === 0 ? "#52525b" : "#fff",
                  border: "1px solid #3f3f46",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  cursor: currentSlideIndex === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span style={{ fontSize: "0.85rem", color: "var(--muted, #a1a1aa)" }}>
                Interplanetary Fund · Confidential Investor Briefing
              </span>
              <button
                disabled={currentSlideIndex === slides.length - 1}
                onClick={() => setCurrentSlideIndex(i => Math.min(slides.length - 1, i + 1))}
                style={{
                  background: "var(--accent, #3b82f6)",
                  color: "#fff",
                  border: "none",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  cursor: currentSlideIndex === slides.length - 1 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Agenda Checklist */}
          <div style={{ background: "var(--card-bg, #1a1a1a)", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border, #333)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Session Agenda & Flow</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
              {session?.agenda?.map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle size={14} color="#4ade80" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Q&A and Chat Panel */}
        <div style={{ background: "var(--card-bg, #1a1a1a)", borderRadius: "8px", border: "1px solid var(--border, #333)", display: "flex", flexDirection: "column", height: "600px" }}>
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border, #333)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MessageSquare size={16} />
            <strong>Executive Q&A Channel</strong>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: msg.role === "user" ? "var(--accent, #3b82f6)" : "#27272a",
                  color: "#fff",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  whiteSpace: "pre-wrap"
                }}
              >
                {msg.content}
              </div>
            ))}
          </div>

          <form onSubmit={handleAskQuestion} style={{ padding: "0.85rem", borderTop: "1px solid var(--border, #333)", display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={inputQ}
              onChange={e => setInputQ(e.target.value)}
              placeholder="Ask Michelle a diligence question..."
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                borderRadius: "4px",
                border: "1px solid #3f3f46",
                background: "#18181b",
                color: "#fff",
                fontSize: "0.85rem"
              }}
            />
            <button
              type="submit"
              disabled={sendingQ}
              style={{
                background: "var(--accent, #3b82f6)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "0 0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem"
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
