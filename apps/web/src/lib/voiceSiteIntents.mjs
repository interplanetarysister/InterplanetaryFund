/**
 * Strict, local intent routing for optional spoken site navigation.
 * These intents NEVER publish, modify accounts, grant OAuth scopes or post.
 * Commands requiring authorization open the existing authenticated UI.
 * Unknown language falls through to the authorized NEXUS question service.
 */
const tidy = value => typeof value === "string"
  ? value.trim().toLowerCase().replace(/[.!?]+$/u, "").replace(/\s+/gu, " ")
  : "";
const intents = Object.freeze([
  { id:"register", route:"/register", label:"Sign up", matcher:/^(?:(?:please )?(?:take me to|open|go to|start|help me with) )?(?:sign ?up|register|create (?:an? |my )?account|make (?:an? |my )?account)(?: (?:for|on) (?:ifund|interplanetary fund))?$/u },
  { id:"login",route:"/login",label:"Log in",matcher:/^(?:(?:please )?(?:take me to|open|go to|help me) )?(?:log ?in|sign ?in|login|authenticate (?:my )?account)$/u },
  { id:"verify",route:"/login",label:"Verify your account",matcher:/^(?:(?:please )?(?:help me|take me to|open|go to) )?(?:verify|confirm|activate) (?:my |the )?(?:email|account|registration)$/u },
  { id:"create",route:"/create?manual=1",label:"Start a campaign",matcher:/^(?:(?:please )?(?:help me|take me to|open|go to|start) )?(?:create|make|start|build|draft) (?:a |my )?(?:fundraiser|fundraising campaign|campaign)$/u },
  { id:"publish_campaign",route:"/campaigns",label:"Review campaigns for publishing",member:true,matcher:/^(?:(?:please )?(?:help me|take me to|open|go to) )?(?:publish|launch|post|make public) (?:my |a |the )?(?:fundraiser|campaign)(?: (?:now|please))?$/u },
  { id:"write_update",route:"/social?kind=update",label:"Write a public update",matcher:/^(?:(?:please )?(?:help me|take me to|open|go to) )?(?:write|draft|create|make) (?:an? |my )?(?:campaign )?(?:update|post)$/u },
  { id:"publish_update",route:"/social?kind=update",label:"Review an update for publishing",member:true,matcher:/^(?:(?:please )?(?:help me|take me to|open|go to) )?(?:publish|share|post) (?:my |an? |the )?(?:campaign )?(?:update|post)(?: (?:now|please))?$/u },
  { id:"external_publish",route:"/connections",label:"Review connected-platform publishing",member:true,matcher:/^(?:(?:please )?(?:help me|take me to|open|go to) )?(?:publish|share|post) (?:my |a |the )?(?:fundraiser|campaign|update|post) (?:to|on|through) (?:my )?(?:connected (?:accounts?|platforms?)|facebook|instagram|tiktok|reddit|x|twitter|bluesky|linkedin)$/u },
  { id:"connections",route:"/connections",label:"Connected accounts",member:true,matcher:/^(?:(?:please )?(?:take me to|open|go to|show me|show my) )?(?:my )?(?:connections|connected accounts|connected platforms|integrations)$/u },
  { id:"dashboard",route:"/dashboard",label:"Dashboard",member:true,matcher:/^(?:(?:please )?(?:take me to|open|go to|show me|show my) )?(?:my )?(?:dashboard|workspace)$/u },
  { id:"agents",route:"/agents",label:"Agent team",matcher:/^(?:(?:please )?(?:take me to|open|go to|show me|show my) )?(?:my )?(?:agent team|agents|chief of staff|nexus)$/u },
  { id:"discover",route:"/discover",label:"Discover campaigns",matcher:/^(?:(?:please )?(?:take me to|open|go to|show me|show my) )?(?:discover|explore campaigns|campaign discovery)$/u },
]);
export function interpretVoiceSiteCommand(transcript,{authenticated=false}={}) {
  const text=tidy(transcript);
  if(!text || text.length>220) return null;
  const match=intents.find(intent=>intent.matcher.test(text));
  if(!match) return null;
  if(match.member && !authenticated) return {
    id:match.id,label:"Sign in to "+match.label.toLowerCase(),
    route:"/login?returnTo="+encodeURIComponent(match.route),
    requiresReview:false,authenticated:false,signInRequired:true
  };
  return {id:match.id,label:match.label,route:match.route,
    requiresReview:match.id.startsWith("publish_") || match.id==="external_publish",
    authenticated:!!authenticated};
}
export function voiceSiteGuidance(action) {
  if(!action) return "";
  if(action.signInRequired) return "I can open secure sign in first. No account action, outside post, or publication has occurred.";
  if(action.id==="verify") return "Open the latest email verification link or enter the code on the secure sign-in page. Spoken words do not verify account ownership.";
  if(action.id==="register") return "I can guide you to sign up. You will review the terms and finish email or provider verification securely; a spoken name is not proof of identity.";
  if(action.id==="login") return "I can open sign in. Use your existing secure sign-in method; please do not speak a password or verification code.";
  if(action.id==="external_publish") return "I can open your connections. Only supported, authorized providers can publish after their own review and confirmation. No outside post has been sent.";
  if(action.requiresReview) return "I can open the review page. Review the final content and confirm publication in your authenticated account; nothing has been posted.";
  return "Opening "+action.label.toLowerCase()+".";
}

// A user-triggered, local mic utterance can open a PRIVATE, unsaved Mission.
// No account is created, and no fundraisers or provider actions are started.
export function goalPromptFromVoice(transcript){
 const raw=typeof transcript==="string"?transcript.trim().replace(/^(?:hey |okay |ok )?(?:alexa|nexus|ifund)[,;.! ]+/i,""):"";
 if(raw.length<18||raw.length>1500)return null;
 if(!/^(?:i|we|my family|our family) (?:want|need|wish|hope|would like|could use)\b/i.test(raw)&&
    !/^help me (?:with|to|achieve|start|build|find)\b/i.test(raw))return null;
 return raw;
}
