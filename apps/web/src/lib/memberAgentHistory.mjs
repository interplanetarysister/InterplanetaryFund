// Convert server-confirmed, same-owner iFund team records into per-agent chat histories.
// The canonical loadTeamHistory() adapter verifies authentication and owner scope.
const AGENTS=new Set(["nexus","story","orbit","polaris","forge","echo","pulse","link","discover"]);
const ANALYSIS_PREFIX="Please analyze my situation and suggest specific, realistic next steps, potential risks, and ways to measure progress. My request: ";
export function groupMemberAgentHistory(rows){
  if(!Array.isArray(rows)) throw Error("Invalid team history.");
  const threads={};
  // RPC returns newest first; display chronological order.
  for(const row of [...rows].reverse()){
    if(!row || !AGENTS.has(row.agent_id) || !["user","agent"].includes(row.speaker)
      || typeof row.content!=="string" || !row.content.trim()
      || typeof row.event_key!=="string") continue;
    const analysis=row.speaker==="user"&&row.content.startsWith(ANALYSIS_PREFIX);
    const text=analysis?row.content.slice(ANALYSIS_PREFIX.length):row.content;
    const item={
      id:"saved:"+row.event_key, kind:row.speaker==="user"?"user":"answer",
      agent:row.agent_id,text,analysis,consultations:[],saved:true,
      recordedAt:row.recorded_at||null
    };
    (threads[row.agent_id]??=[]).push(item);
  }
  return threads;
}
