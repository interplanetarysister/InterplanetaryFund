import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { PlusCircle, Flame, CheckCircle2, FileEdit, Rocket } from "lucide-react";

// Tabbed campaign management view — separates active fundraising projects
// from completed ones and drafts, so organizers can quickly switch context.
const TABS = [
  { key: "active", label: "Active", icon: Flame },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
  { key: "draft", label: "Drafts", icon: FileEdit },
];

function partition(campaigns) {
  return {
    active: campaigns.filter((c) => c.status === "active" || c.status === "paused"),
    completed: campaigns.filter((c) => c.status === "completed"),
    draft: campaigns.filter((c) => c.status === "draft"),
  };
}

export default function CampaignTabs({ campaigns, emptyCta = true }) {
  const [tab, setTab] = useState("active");
  const groups = partition(campaigns);
  const list = groups[tab] || [];

  return (
    <div>
      <div className="flex items-center gap-1 sm:gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const count = groups[key]?.length || 0;
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 min-h-[40px] text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                  : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-200" : "bg-stone-200/70 text-stone-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">
            {tab === "active" && "No active campaigns yet"}
            {tab === "completed" && "No completed campaigns yet"}
            {tab === "draft" && "No drafts saved"}
          </p>
          <p className="text-sm text-stone-500 mb-5">
            {tab === "active" && "Open your Interplanetary Fund and start receiving support now."}
            {tab === "completed" && "Campaigns you finish will appear here for your records."}
            {tab === "draft" && "Save a campaign as a draft to finish and launch later."}
          </p>
          {emptyCta && (tab === "active" || tab === "draft") && (
            <Link to="/create">
              <Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90">
                <PlusCircle className="w-4 h-4 mr-2" /> Start a campaign
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((c) => <div key={c.id} className="space-y-2"><CampaignCard campaign={c} />{tab === "draft" && <Link to={`/create?draft=${encodeURIComponent(c.id)}`} className="block"><Button variant="outline" className="w-full rounded-xl border-cyan-500/30 text-cyan-700 dark:text-cyan-200"><Rocket className="w-4 h-4 mr-2" /> Continue building</Button></Link>}</div>)}
        </div>
      )}
    </div>
  );
}