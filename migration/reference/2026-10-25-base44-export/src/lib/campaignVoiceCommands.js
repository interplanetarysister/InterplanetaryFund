// Deliberate command grammar: microphone text never becomes executable code,
// arbitrary agent tools, payment authorization, or a public-publish operation.
export function campaignVoiceCommand(value) {
  const text = String(value || '').trim().replace(/^alexa[,\s:]*/i, '').trim();
  const lower = text.toLowerCase().replace(/[.!?]+$/, '');
  if (/^(stop|cancel|stop speaking|be quiet)$/.test(lower)) return { action: 'stop' };
  if (/^(help|what can i say)$/.test(lower)) return { action: 'help' };
  if (/^(read|read back|read my campaign|review|review campaign)$/.test(lower)) return { action: 'review' };
  if (/^(save|save draft|save as a draft|save (it|this|my campaign) as a draft|save my draft)$/.test(lower)) return { action: 'save' };
  if (/^(generate|create|make)( me)? (an? |the )?(image|picture|photo|cover)( for (it|my campaign))?$/.test(lower)) return { action: 'image' };
  if (/^(generate|create|make|write)( me)? (a |the |my )?story$/.test(lower)) return { action: 'story' };
  if (/^(generate|create|make|show)( me)? (five |5 |some )?(titles|title ideas|title choices)$/.test(lower)) return { action: 'titles' };
  const choice=lower.match(/^(?:use|choose|pick|select)(?: the)? (first|second|third|fourth|fifth|one|two|three|four|five|[1-5])(?: title| option| choice)?$/);
  if(choice) return { action:'choose',index: ({first:0,second:1,third:2,fourth:3,fifth:4,one:0,two:1,three:2,four:3,five:4})[choice[1]] ?? Number(choice[1])-1 };
  const goal=lower.match(/^(?:set|change)(?: the| my)? goal to \$?([\d,]+(?:\.\d{1,2})?)(?: dollars)?$/);
  if(goal) return {action:'goal',amount:Number(goal[1].replaceAll(',',''))};
  const title=text.match(/^(?:set|change)(?: the| my)? title to (.+)$/i);
  if(title) return {action:'title',text:title[1].slice(0,160)};
  return {action:'details',text};
}
export function initialVoiceBrief(text) {
  const match=text.match(/(?:\$\s*|raise\s+)([\d,]+(?:\.\d{1,2})?)(?:\s*dollars)?/i);
  return {purpose:text,goal:match?Number(match[1].replaceAll(',','')):null};
}
