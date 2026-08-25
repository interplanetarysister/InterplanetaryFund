/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Facebook outreach remains read-only until a real Facebook OAuth/Graph API connection is configured. */
export default function FacebookGroups() {
  const dashboard = useQuery(api.facebook.getOutreachDashboard, {});
  const allGroups = useQuery(api.facebook.getAllDiscoveredGroups, {});
  const allPosts = useQuery(api.facebook.getAllPosts, {});

  if (!dashboard || !allGroups || !allPosts) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="card border-ifyellow/30">
        <h2 className="text-base font-semibold text-iftext">Facebook Group Outreach</h2>
        <p className="text-xs text-ifmuted mt-2">Live Facebook OAuth and Graph API credentials are required before Interplanetary Fund can connect an account, discover groups, request membership, or publish posts. No simulated accounts, tokens, groups, or posting results are used.</p>
        <p className="text-xs text-ifyellow mt-3 font-semibold">Status: Integration credentials required</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center"><p className="text-2xl font-bold text-ifcyan">{dashboard.groups.total}</p><p className="text-[10px] text-ifmuted mt-1">Recorded Groups</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-ifgreen">{dashboard.groups.joined}</p><p className="text-[10px] text-ifmuted mt-1">Recorded Joined</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-ifaccent">{dashboard.posts.posted}</p><p className="text-[10px] text-ifmuted mt-1">Recorded Posts</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-ifyellow">{dashboard.groups.totalReach.toLocaleString()}</p><p className="text-[10px] text-ifmuted mt-1">Recorded Reach</p></div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext">Connection requirements</h3>
        <ul className="mt-3 space-y-2 text-xs text-ifmuted list-disc pl-5">
          <li>Real Facebook OAuth authorization for the applicable account.</li>
          <li>Real platform-issued identifiers and credentials through the approved connection flow.</li>
          <li>Only permissions actually granted by Facebook may be reported.</li>
          <li>Group discovery and publishing must come from real platform responses; generated/mock groups are prohibited.</li>
        </ul>
      </div>

      {allGroups.groups.length > 0 && <div><h3 className="text-sm font-semibold text-iftext mb-3">Previously recorded groups</h3><div className="space-y-2">{allGroups.groups.slice(0,25).map((g:any)=><div key={g._id} className="card flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-iftext">{g.groupName}</p><p className="text-[10px] text-ifmuted mt-1">{g.memberCount.toLocaleString()} members · {g.groupCategory}</p></div><span className="text-[10px] font-semibold text-ifmuted">{g.joinStatus}</span></div>)}</div></div>}

      {allPosts.posts.length > 0 && <div><h3 className="text-sm font-semibold text-iftext mb-3">Recorded posts</h3><div className="space-y-2">{allPosts.posts.slice(0,10).map((p:any)=><div key={p._id} className="card"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-iftext">{p.groupName}</span><span className="text-[10px] font-semibold text-ifmuted">{p.postStatus}</span></div><p className="text-xs text-ifmuted mt-2 line-clamp-2">{p.postContent}</p></div>)}</div></div>}
    </div>
  );
}
