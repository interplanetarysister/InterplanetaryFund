// Defense in depth for owner-approved facts copied into agent drafts.
// Never mutate original documents; server screening and owner review remain required.
export function redactDocumentReferenceSecrets(value){
  const text=String(value??"");
  // Escaped JSON credential fields are ambiguous: discard the whole payload.
  if(/\\["'](?:[^"']{0,40})(?:password|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)\\["']\s*:/i.test(text))
    return "[redacted credential payload]";
  return text
    .replace(/(["'])(?:[a-z0-9_-]*[_-])?(?:password|passphrase|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|authorization|oauth[_-]?code|code)\1\s*:\s*(?:["'][^"']*["']|[^\s,}]+)/gi,
      "[redacted credential field]")
    .replace(/\b((?:[a-z0-9]+_)*(?:password|passphrase|api_key|access_token|refresh_token|client_secret|private_key|oauth_code|authorization|secret))(\s*[:=]\s*)(["']?)([^\s,;}"']+)(["']?)/gi,
      (_all,key,sep,open,_secret,close)=>key+sep+open+"[redacted]"+close)
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{8,}/gi,"[redacted credential]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,"[redacted credential]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g,"[redacted credential]")
    .replace(/https?:\/\/[^\s<>"']+/gi,url=>{
      let normalized=url;
      for(let i=0;i<4;i++){
        const decoded=normalized.replace(/%[0-9a-f]{2}/gi,match=>{
          const v=parseInt(match.slice(1),16);
          return v<128?String.fromCharCode(v):match;
        }).replace(/&amp;/gi,"&");
        if(decoded===normalized)break;
        normalized=decoded;
      }
      return /(?:[?&#;])(?:code|auth[_-]?code|oauth[_-]?code)=/i.test(normalized)
        ?"[redacted authorization URL]":url;
    });
}
