/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Help() {
  const [category, setCategory] = useState<string>("All");
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const articles = useQuery(api.support.getHelpArticles, category === "All" ? {} : { category });
  const markHelpful = useMutation(api.support.markHelpful);
  const createTicket = useMutation(api.support.createTicket);

  const categories = ["All", "Getting Started", "Donations", "Payouts", "Account & Security"];

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim() || !ticketEmail.trim()) return;
    await createTicket({
      subject: ticketSubject,
      message: ticketMessage,
      name: ticketEmail,
      email: ticketEmail,
      });
    setTicketSubmitted(true);
    setTicketSubject("");
    setTicketMessage("");
    setTicketEmail("");
    setTimeout(() => { setShowTicketForm(false); setTicketSubmitted(false); }, 3000);
  };

  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedArticle(null)}
          className="text-ifcyan text-sm flex items-center gap-1"
        >
          ← Back to Help
        </button>
        <div className="bg-ifbg2 rounded-2xl p-5 border border-ifborder">
          <h2 className="text-lg font-bold text-white mb-2">{selectedArticle.question}</h2>
          <p className="text-ifmuted text-sm leading-relaxed">{selectedArticle.answer}</p>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ifborder">
            <button
              onClick={() => markHelpful({ articleId: selectedArticle._id, helpful: true })}
              className="text-xs text-ifmuted hover:text-ifcyan flex items-center gap-1"
            >
              👍 Helpful ({selectedArticle.helpfulYes})
            </button>
            <button
              onClick={() => markHelpful({ articleId: selectedArticle._id, helpful: false })}
              className="text-xs text-ifmuted hover:text-red-400 flex items-center gap-1"
            >
              👎 Not helpful ({selectedArticle.helpfulNo})
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-white">Help Center</h1>
        <p className="text-ifmuted text-sm mt-1">Find answers and get support</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${
              category === cat
                ? "bg-ifaccent text-white"
                : "bg-ifbg2 text-ifmuted border border-ifborder"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {!articles ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <p className="text-center text-ifmuted text-sm py-10">No articles found</p>
      ) : (
        <div className="space-y-2">
          {articles.map((a: any) => (
            <button
              key={a._id}
              onClick={() => setSelectedArticle(a)}
              className="w-full text-left bg-ifbg2 rounded-xl p-4 border border-ifborder hover:border-ifaccent transition"
            >
              <p className="text-white text-sm font-medium">{a.question}</p>
              <p className="text-ifmuted text-xs mt-1">{a.category}</p>
            </button>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-ifborder">
        {showTicketForm ? (
          <div className="bg-ifbg2 rounded-2xl p-4 border border-ifborder space-y-3">
            {ticketSubmitted ? (
              <p className="text-ifcyan text-sm text-center py-4">
                ✓ Ticket submitted! We'll get back to you soon.
              </p>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Your email"
                  value={ticketEmail}
                  onChange={(e) => setTicketEmail(e.target.value)}
                  className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-sm"
                />
                <textarea
                  placeholder="Describe your issue..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitTicket}
                    className="flex-1 bg-ifaccent text-white rounded-lg py-2 text-sm font-medium"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => setShowTicketForm(false)}
                    className="px-4 bg-ifbg border border-ifborder text-ifmuted rounded-lg py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowTicketForm(true)}
            className="w-full bg-ifbg2 border border-ifborder rounded-xl py-3 text-sm text-ifmuted hover:text-ifcyan transition"
          >
            Still need help? Submit a ticket
          </button>
        )}
      </div>
    </div>
  );
}
