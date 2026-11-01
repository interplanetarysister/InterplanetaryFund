import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const roleStyles = {
  owner: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100",
  moderator: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  member: "bg-stone-100 text-stone-600 hover:bg-stone-100",
};

export default function MembersTab({ members }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {(m.user_name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <Link className="text-sm font-medium text-blue-800 hover:underline" to={`/u/${m.user_id}`}>{m.user_name || "IFund member"}</Link>
              <p className="text-xs text-stone-400">Joined {format(new Date(m.created_date), "MMM yyyy")}</p>
            </div>
          </div>
          <Badge className={roleStyles[m.role] || roleStyles.member}>{m.role}</Badge>
        </div>
      ))}
    </div>
  );
}