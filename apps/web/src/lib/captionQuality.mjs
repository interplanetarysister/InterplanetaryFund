// Caption coherence guard for AI-generated wording on generated media.
//
// The image/video models never draw lettering; iFund renders the approved
// caption text itself. AI may now DRAFT that wording, but a draft is only
// usable if it is made of real words in coherent phrasing. This module is
// the deterministic check that enforces it, shared by the caption Worker
// route (which regenerates once, then falls back) and available to the
// client for instant feedback.
//
// A caption fails when any token shows a hard letter-salad signal
// (impossible consonant runs, vowel-less strings, keyboard mash, repeated
// letters, digit-letter mash) or when too many of its words are unknown
// to the core lexicon and are not explainable as names, hashtags,
// mentions, or words from the member's own context (campaign title and
// description words are always allowed — proper nouns and campaign names
// must never be false-flagged).

export const CAPTION_MAX_CHARS = 100;

const CORE_WORDS = new Set((
  // Function words, pronouns, auxiliaries, prepositions, conjunctions.
  "a an the and or but if then else when while until because although since so as at by for from in into of off on onto out over to under up upon with within without about above across after against along among around before behind below beneath beside between beyond during inside like near outside through toward towards " +
  "i me my mine we us our ours you your yours he him his she her hers it its they them their theirs this that these those who whom whose which what where why how all any both each few more most other some such no nor not only own same too very can could will would shall should may might must do does did done have has had having be am is are was were been being " +
  "here there now today tonight tomorrow yesterday soon later early always never often sometimes together again once twice first second third next last new old other another " +
  // Common verbs.
  "ask become begin bring build buy call carry catch change choose clean close come cook count create cry cut dance draw dream drink drive eat fall feel find fly follow forget forgive get give go grow hear help hide hit hold hope hug hunt join jump keep kick kiss know laugh lead learn leave lend let lie lift listen live look lose love make meet move need open paint pay pick plant play pray promise pull push put rain raise reach read remember ride ring rise run save say see seek seem sell send serve set sew shake share shop show sing sit sleep smile snow speak spend stand start stay stop study swim swing take teach tell thank think throw touch train travel try turn visit wait wake walk want wash watch water wear win wish work write " +
  // People, family, community.
  "adult aunt baby boy brother child children community cousin dad daughter doctor family father friend friends girl grandma grandmother grandpa grandfather group husband kid kids lady man men mom mother neighbor neighbors nurse parent parents people person sister son student students teacher team uncle volunteer volunteers wife woman women youth " +
  // Home, school, daily life.
  "animal animals art baby back bag ball bed bike bird book books box bus car card care cat chair city class classroom clothes coat coffee college color computer country day desk dog door dream dress egg eggs farm field fire fish flower flowers food foot garden gift glass hand hat head health heart home horse house job kitchen land language leg letter life light line list map milk money month morning music name night number page paper park party pen picture piece place plant room school sea season seed shop show side sky snow song space spring store story street summer sun table thing time town tree trip water way week winter word world year " +
  // Nature, food, body.
  "apple apples banana bananas bean beans bread butter cake carrot carrots cheese chicken corn egg fruit fruits grape grapes lemon lemonade lunch meal meals meat melon orange oranges peach pizza potato potatoes rice salad salt soup sugar tea tomato tomatoes vegetable vegetables " +
  "arm arms body ear ears eye eyes face finger fingers hair hand hands head heart leg legs mouth neck nose shoulder shoulders tooth teeth " +
  "beach cloud clouds earth forest garden grass green hill hills island lake leaf leaves moon mountain mountains ocean rain rainbow river rock sand sea sky snow star stars sun tree trees valley wave waves wind winter wood woods " +
  // Fundraising and campaign domain.
  "aid assist award awards benefit campaign campaigns cause causes charity cheer classroom cleanup clinic clothes club college community concert contest crisis donate donated donates donating donation donations donor donors drive effort emergency event events fair faith festival food fund fundraiser fundraising funds gear gift gifts goal grant grants groceries healing health help helping homeless hope hospital housing hygiene interplanetary fund journey kit kits library local meals medical member members mentor mission music need needs neighbor outreach pantry park playground program project raffle rebuild recovery relief rescue resource resources ride rides safe scholarship school shelter sheltered supplies support supported supporting team thank thanks therapy tools tour tournament toy toys transport treatment trip tuition uniform uniforms veteran veterans village volunteer water well wellness wheel wheelchair youth " +
  // Descriptive words.
  "able afraid alone amazing angry beautiful best better big brave bright busy calm careful clean clear clever close cold cool creative dark dear deep different difficult dry early easy empty enough every fair fast favorite few fine firm first free fresh friendly full funny gentle glad good great green happy hard healthy heavy high honest hot huge hungry important joyful kind large last late light little local long loud lovely low lucky main many merry mild more most much near new next nice old open own peaceful proud public pure quick quiet ready real red rich right rough round safe same second serious several sharp shelter short simple single slow small smart soft solid special strong sure sweet tall warm weekly welcome wet white whole wide wild wise wonderful young " +
  // Extra everyday vocabulary and y-vowel words models commonly use.
  "across adventure also area around arrive basket beautiful become birthday blanket blossom bottle bottom breakfast bridge bright bubble bucket butterfly camera candle candy castle celebration center chance chapter charity cheerful cherry chicken children chocolate church circle city clean clear climb clock close clothes cloud coach coast coconut collect color comfort cookie corner cotton country courage cousin crayon creative cricket crowd crown crystal culture curious curtain cushion custom dance danger daughter dawn day dear december decorate deep deer desert design desk dessert detail dinner dinosaur discover dish distance doctor dolphin door dove dozen dragon dream dress drift drink drive drop dry duck dust duty eagle early earn earth easy echo edge effort egg eight elbow elephant elevator elf eleven empty energy engine enjoy enough enter envelope equal eraser escape even evening event every exact exam example excellent except excited excuse exercise exit expert explain explore extra eye fabric face fact factory fair faith fall false family famous fancy farm farmer fast fat fate father feather february feel fence fern festival fever field fierce fifteen fig fight figure file fill film final find fine finger finish fire first fish fishing fit five fix flag flame flash flat flavor fleece fleet flesh float flood floor flour flow flower fluent fly foam focus fog foil fold folk follow fond food fool foot for force forest forever forget fork form fortune forward fossil found fountain four fox fraction frame free freedom freeze fresh friction friend frog from front frost fruit fuel full fun fur future gain galaxy game gap garden garlic gas gate gather gear gem general gentle gesture ghost giant gift giggle girl give glacier glad glance glass glide gloom glory glove glow goal goat gold golf good goose gorilla govern grab grace grade grain grand grape graph grasp grass grateful gray great green greet grid grief grin grip grocery ground group grove grow guard guess guest guide guitar gym habit hair half hall hamster hand handle handsome happen happy harbor hard harm harvest hat hatch have hawk hazard head heal health hear heart heat heaven heavy hedge heel height hello helmet help hen her here hero hidden hide high hill hint hip hire history hit hobby hockey hold hole holiday hollow home honest honey honor hood hook hope horn horse hose host hotel hour house hover howl huge human humble humor hungry hunt hurry hurt husband hybrid ice icon idea ideal idle igloo ignore ill image imagine immense impact important impose improve inch include income indeed index indoor infant infect influence inform inhale initial inject injury inner input insect inside insight inspire install instant instead insult intact intake integer intend intense interact interest interim interior internal internet interpret interrupt interval interview into invent invest invite involve iron island issue item ivory jacket january jazz jeans jelly jewel job join joint joke journal journey joy judge juice july jump june jungle junior junk just keen keep kernel kettle key kick kid kidney kill kind kingdom kiss kit kitchen kite kitten knee knife knock know koala label labor lace ladder lady lake lamp land landscape lane language lantern large laser last late laugh laundry lava law lawn layer lazy lead leaf league lean learn leather leave lecture left leg legal legend leisure lemon lend length lens lesson let letter level liberty library license lick lid life lift light lightning like likely limb limit line link lion liquid list listen liter little live lizard load loaf loan lobster local lock log logic lonely long look loose lose loss lot loud love lovely lover low lower luck luggage lumber lunch lung luxury machine mad magic magnet maid mail main major make male mall mammal man manage manner many map marble march margin marine mark market marriage married mask mass master match mate math matter may maze meal mean measure meat mechanic medal media medical meet melon melt member memory mental mention mentor menu mercy mere merit mess metal meter method middle might mild mile milk mill mind mine mineral mini minor minute miracle mirror miss mistake mix mobile mode model modern modest modify mom moment money monitor monkey monster month mood moon moral more morning mosquito most mother motion motor mount mouse mouth move movie much mud muffin mule multiply muscle museum mushroom music musical must mutual myself mystery myth nail name napkin narrow nation native nature near neat neck need needle negative neighbor neither nerve nest net neutral never new news next nice night nine no noble nod noise none noodle noon nor normal north nose not note nothing notice notion novel now number nurse nut oak obey object obtain obvious occasion occur ocean october odd of off offer office often oil okay old olive on once one onion online only onto open opera opinion oppose option orange orbit orchard order organ origin other otter our out outcome outer outfit outline output outside oven over owe owl own owner oxygen pace pack package pad page pain paint pair palace pale palm panda panel panic paper parade parent park part partner party pass past patch path patient pattern pause paw pay peace peach peak peanut pearl peasant pedal peek peel peep peer pen pencil penguin people pepper perfect perform perhaps period permanent permit person pest pet pharmacy phase phone photo phrase piano pick picnic picture piece pig pigeon pile pill pilot pin pink pioneer pipe pirate pit pitch pizza place plain plan plane planet plant plastic plate play plaza pleasant please plenty plot plug plum plus pocket poem poet point polar police policy polish polite pond pool poor pop popular pork port pose position positive possess possible post pot potato potential pound pour powder power practice praise pray precise predict prefer prepare present press pretend pretty prevent price pride priest primary prime prince princess print prior prison private prize probably problem process produce product profession professor profile profit program progress project promise prompt proof proper property propose protect proud prove provide public pudding puff pull pulp pulse pumpkin punch pupil purchase pure purple purpose purse push put puzzle pyramid quack quail quality quantity quarter queen question quick quiet quilt quit quite quota quote rabbit raccoon race rack radio rail rain raise rally ram ranch random range rapid rare rate rather ratio raven raw ray reach react read ready real realm rear reason rebel recall receive recent recess recipe record recycle red reduce refer reflect reform refrigerator refuse region regret regular rehearse reign rein relax release relief rely remain remark remember remind remote remove rent repair repeat replace reply report represent reptile request rescue research resemble reserve resident resist resource respect respond rest restaurant result resume retain retire return reveal review reward rhyme ribbon rice rich ride ridge rifle right rigid rim ring rinse ripe rise risk rival river road roar roast robot rock rocket role roll roof rookie room root rope rose rough round route row royal rub rude rug rule run rural rush rust sacred sad saddle safe sail salad salary sale salmon salt same sample sand sap satisfied saturday sauce save say scale scan scare scene schedule scheme school science scissors score scout scrap screen script scrub sculpt sea seal search season seat second secret section security seed seek seem segment seize select sell semester send sense sentence separate september series serious serve session set settle seven several severe sew shade shadow shaft shake shall shame shampoo shape share shark sharp shave sheep sheet shelf shell sheriff shield shift shine ship shiver shock shoe shoot shop shore short shout show shower shut shy sick side sigh sight sign signal silence silk silly silver similar simple since sing single sink sir sister sit six size ski skill skin skirt sky slam slap sled sleep slice slide slight slim slip slope slow small smart smell smile smoke smooth snack snail snake snap snatch sneak snow so soap soccer social sock soda soft soil solar soldier solid solution solve some son song soon sophisticated sore sorrow sort soul sound soup source south space spare spark speak special species speed spell spend sphere spice spider spill spin spirit split spoke sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stain stair stake stamp stand star stare start state station statue stay steady steal steam steel steep steer stem step stick still sting stock stomach stone stoop stop store storm story stove straight strange strap straw stray stream street stress stretch strict strike string strip stroke strong structure struggle student studio study stuff stupid style subject submit substance succeed such sudden suffer sugar suggest suit sum summer sun sunday sunset super supper supply support suppose supreme sure surface surprise surround survey survive suspect sustain swan swap swear sweat sweep sweet swell swept swim swing switch sword symbol symptom syrup system table tackle tail take tale talent talk tall tank tap tape target task taste tattoo taxi teach team tear technical teen tell temper temple ten tennis tense tent term terrace terrible test text thank theater their theme then theory therapy there thick thief thin thing think third thirsty thirty this thorough those though thought thousand threat three throat through throw thumb thursday thus ticket tide tidy tie tiger tight tile till timber time tin tiny tip tire title to toast today toe together toilet tomato tomorrow ton tone tongue tonight too tool tooth top topic toss total touch tough tour toward towel tower town toy trace track trade tradition traffic trail train transfer transform transit translate trap travel tray treasure treat tree trend trial tribe trick trigger trim trip troop trouble truck true truly trunk trust truth try tube tuition tumble tuna tunnel turkey turn turtle tutor twelve twenty twice twin two type typical ugly umbrella uncle under undo unfair uniform union unique unit united universe unknown unless unlike unlock until unusual up update upgrade upon upper upset urban urge us use used useful usual utensil utter vacation vacuum valid valley value valve van various vary vast vegetable vehicle vendor venture verbal verdict version very vessel vest veteran via vibrant vice victory video view village vine vintage violin virtual virus visa visible vision visit vital vitamin vivid vocal voice volcano volume volunteer vote vowel voyage wade wage wagon waist wait wake walk wall walnut want war ward warm warn wash waste watch water wave way we weak wealth weapon wear weasel weather web wedding weed week weigh welcome welfare well west wet whale what wheat wheel when where whether which while whip whisper white who whole whom whose why wide widow width wife wild will win wind window wine wing wink winner winter wipe wire wisdom wise wish with withdraw within without witness wolf woman wonder wood wool word work world worry worse worship worst worth would wound wrap wreck wrist write wrong yard year yell yellow yes yesterday yet yield yoga you young your youth zebra zero zigzag zone zoo " +
  // Contractions and possessives in normalized (apostrophe-free) form.
  "dont cant wont isnt arent wasnt werent havent hasnt hadnt doesnt didnt couldnt shouldnt wouldnt lets thats whats heres theres im ive ill youre youve youll hes shes weve theyve itll thatll " +
  // Calendar words.
  "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december " +
  // Numbers as words.
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million first second third fourth fifth once twice"
).split(/\s+/).filter(Boolean));

const DOMAIN_ALLOWANCES = new Set([
  "ifund", "interplanetaryfund", "rsvp", "covid", "stem", "prek", "pta", "ngo",
  "rhythm", "hymn", "myth", "myths", "glyph", "gym", "gyms", "lynx", "sync",
  "cyst", "nymph", "pygmy", "tryst", "shyly", "sly", "pry", "wry", "by",
]);

// Light inflection matching so ordinary inflected forms of known words
// (starts, growing, helped, bigger) count as known without letting
// invented words through: the stem itself must be a core word.
function knownWord(word) {
  if (CORE_WORDS.has(word) || DOMAIN_ALLOWANCES.has(word)) return true;
  const stems = [];
  if (word.endsWith("ies") && word.length > 4) stems.push(word.slice(0, -3) + "y");
  if (word.endsWith("ing") && word.length > 5) {
    stems.push(word.slice(0, -3), word.slice(0, -3) + "e");
    const base = word.slice(0, -3);
    if (base.length > 2 && base.at(-1) === base.at(-2)) stems.push(base.slice(0, -1));
  }
  if (word.endsWith("ed") && word.length > 4) {
    stems.push(word.slice(0, -2), word.slice(0, -1));
    const base = word.slice(0, -2);
    if (base.length > 2 && base.at(-1) === base.at(-2)) stems.push(base.slice(0, -1));
  }
  if (word.endsWith("es") && word.length > 4) stems.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) stems.push(word.slice(0, -1));
  if (word.endsWith("er") && word.length > 4) stems.push(word.slice(0, -2), word.slice(0, -2) + "e");
  if (word.endsWith("est") && word.length > 5) stems.push(word.slice(0, -3));
  if (word.endsWith("ly") && word.length > 4) stems.push(word.slice(0, -2));
  return stems.some((stem) => CORE_WORDS.has(stem) || DOMAIN_ALLOWANCES.has(stem));
}

const CONSONANTS = new Set("bcdfghjklmnpqrstvwxz".split(""));
const KEYBOARD_RUNS = ["asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "qwer", "wert", "erty", "rtyu", "tyui", "yuio", "uiop", "zxcv", "xcvb", "cvbn", "vbnm"];

function splitHashtagBody(body) {
  return body
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
}

function normalizeWord(raw) {
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/'s$/, "")
    .replace(/'/g, "");
}

function saladReason(word) {
  if (word.length > 20) return "overlong token";
  let run = 0;
  for (const ch of word) {
    run = CONSONANTS.has(ch) ? run + 1 : 0;
    if (run >= 5) return "consonant salad";
  }
  if (word.length >= 4 && !/[aeiou]/.test(word) && !knownWord(word))
    return "vowel-less token";
  if (/(.)\1{3,}/.test(word)) return "repeated letters";
  if (/[a-z]/.test(word) && /\d/.test(word) && word.length >= 4 &&
      !DOMAIN_ALLOWANCES.has(word))
    return "digit-letter mash";
  for (const seq of KEYBOARD_RUNS)
    if (word.includes(seq)) return "keyboard mash";
  return null;
}

function caseAlternations(raw) {
  let count = 0;
  for (let i = 1; i < raw.length; i++)
    if ((/[a-z]/.test(raw[i - 1]) && /[A-Z]/.test(raw[i])) ||
        (/[A-Z]/.test(raw[i - 1]) && /[a-z]/.test(raw[i]))) count++;
  return count;
}

/**
 * Inspect a caption and return the list of nonsense findings
 * ({ token, reason }). An empty list means the wording is coherent:
 * real words, explainable names, no letter salad.
 * contextWords: words from the member's own context (campaign title,
 * description, names) that are always acceptable.
 */
export function findCaptionNonsense(text, { contextWords = [] } = {}) {
  if (typeof text !== "string") return [{ token: "", reason: "not text" }];
  const context = new Set(contextWords.map((w) => normalizeWord(String(w))));
  const findings = [];
  const unknown = [];
  let wordTotal = 0;
  const rawTokens = text.split(/\s+/).filter(Boolean);
  rawTokens.forEach((rawToken, tokenIndex) => {
    if (/^[@#]/.test(rawToken) === false && !/[A-Za-z]/.test(rawToken)) return;
    if (rawToken.startsWith("@")) return; // a mention is a name
    const isHashtag = rawToken.startsWith("#");
    const body = rawToken.replace(/^#/, "");
    const parts = isHashtag
      ? splitHashtagBody(body)
      : body.split(/[^A-Za-z'’-]+/).filter(Boolean);
    for (const part of parts) {
      const word = normalizeWord(part);
      if (!word || /^\d+$/.test(word)) continue;
      wordTotal++;
      if (knownWord(word) || context.has(word))
        continue;
      const salad = saladReason(word);
      if (salad) { findings.push({ token: part, reason: salad }); continue; }
      if (part.length >= 5 && caseAlternations(part) >= 3) {
        findings.push({ token: part, reason: "garbled casing" });
        continue;
      }
      // A capitalized word after the first token reads as a proper noun —
      // names must not be false-flagged.
      if (tokenIndex > 0 && /^[A-Z]/.test(part)) continue;
      unknown.push(part);
    }
  });
  if (unknown.length >= 2 && wordTotal > 0 && unknown.length / wordTotal > 0.34)
    findings.push({ token: unknown.join(" "), reason: "too many unrecognized words" });
  else if (unknown.length >= 3)
    findings.push({ token: unknown.join(" "), reason: "too many unrecognized words" });
  return findings;
}

export function captionIsCoherent(text, options) {
  return findCaptionNonsense(text, options).length === 0;
}

/**
 * The clean fallback used when AI wording fails the guard twice: the
 * campaign title itself (a factual caption the member already wrote), or
 * a plain factual sentence. Never pleading, never invented.
 */
export function fallbackCaption(title) {
  const clean = typeof title === "string"
    ? title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
    : "";
  if (clean.length >= 4) return clean.slice(0, CAPTION_MAX_CHARS).trim();
  return "A community fundraiser on Interplanetary Fund.";
}
