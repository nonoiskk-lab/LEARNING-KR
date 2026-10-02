/**
 * Offline demo tutor. Used when no ANTHROPIC_API_KEY is configured so the
 * whole product (voice, avatar, corrections, memory, progress, billing) can be
 * explored and tested without AI spend. It recognises a set of very common
 * learner errors with rules; the real teacher is Claude (see teacher.ts).
 */
import type { Correction, TeacherTurn } from "./schema";
import type { TeacherRequest } from "./teacher";

interface Rule {
  test: RegExp;
  fix: (s: string) => string;
  c: Omit<Correction, "youSaid" | "better" | "moreNatural">;
  natural?: (s: string) => string;
}

const RULES: Rule[] = [
  {
    test: /\b(am|is|are)\s+(\w+ing)\b([^.?!]*)\bsince\s+(\w+\s+)?(years?|months?|weeks?|days?|hours?)\b/i,
    fix: (s) => s.replace(/\b(I am|I'm|we are|they are|he is|she is|am|is|are)\s+(\w+ing)\b([^.?!]*)\bsince\s+((?:\w+\s+)?(?:years?|months?|weeks?|days?|hours?))/i, (_m, subj: string, v: string, mid: string, dur: string) => `${perfectSubject(subj)} been ${v}${mid}for ${dur}`),
    c: { category: "grammar", why: "For an action that started in the past and continues now, use 'have been + -ing', and 'for' with a length of time.", patternKey: "for_vs_since", patternLabel: "for vs since / present perfect" },
  },
  {
    test: /\bsince\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|many|few|a few)\s+(years?|months?|weeks?|days?|hours?)\b/i,
    fix: (s) => s.replace(/\bsince\s+((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|many|few|a few)\s+(?:years?|months?|weeks?|days?|hours?))/i, "for $1"),
    c: { category: "grammar", why: "Use 'for' with a length of time (for two years) and 'since' with a starting point (since 2020).", patternKey: "for_vs_since", patternLabel: "for vs since" },
  },
  {
    test: /\b(he|she|it|my \w+)\s+(go|do|have|want|like|work|live|say|make)\b/i,
    fix: (s) => s.replace(/\b(he|she|it|my \w+)\s+(go|do|have|want|like|work|live|say|make)\b/i, (_m, a: string, v: string) => `${a} ${thirdPerson(v)}`),
    c: { category: "grammar", why: "With he/she/it in the present simple, add -s to the verb.", patternKey: "third_person_s", patternLabel: "he/she/it + verb-s" },
  },
  {
    test: /\b(didn't|did not)\s+(went|saw|ate|came|took|got|made|did)\b/i,
    fix: (s) => s.replace(/\b(didn't|did not)\s+(went|saw|ate|came|took|got|made|did)\b/i, (_m, d: string, v: string) => `${d} ${baseForm(v)}`),
    c: { category: "grammar", why: "After 'didn't', use the base verb: didn't go, didn't see.", patternKey: "did_plus_base_verb", patternLabel: "didn't + base verb" },
  },
  {
    test: /\bI am (engineer|doctor|teacher|student|developer|manager|designer|nurse|accountant)\b/i,
    fix: (s) => s.replace(/\bI am (engineer|doctor|teacher|student|developer|manager|designer|nurse|accountant)\b/i, (_m, j: string) => `I am ${/^[aeiou]/i.test(j) ? "an" : "a"} ${j}`),
    c: { category: "grammar", why: "Use 'a' or 'an' before a job: I'm an engineer.", patternKey: "missing_article", patternLabel: "a/an before jobs" },
    natural: (s) => s.replace(/\bI am (an?) /i, "I'm $1 "),
  },
  {
    test: /\bI am agree\b/i,
    fix: (s) => s.replace(/\bI am agree\b/i, "I agree"),
    c: { category: "grammar", why: "'Agree' is a verb, so we don't use 'am' with it.", patternKey: "be_plus_agree", patternLabel: "I agree (not I am agree)" },
  },
  {
    test: /\bmore (better|easier|bigger|faster|cheaper|worse)\b/i,
    fix: (s) => s.replace(/\bmore (better|easier|bigger|faster|cheaper|worse)\b/i, "$1"),
    c: { category: "grammar", why: "'Better', 'easier' are already comparative — don't add 'more'.", patternKey: "double_comparative", patternLabel: "double comparative" },
  },
  {
    test: /\bdiscuss about\b/i,
    fix: (s) => s.replace(/\bdiscuss about\b/i, "discuss"),
    c: { category: "word_choice", why: "'Discuss' doesn't need 'about': we discuss a topic.", patternKey: "discuss_about", patternLabel: "discuss (no 'about')" },
  },
  {
    test: /\breturn back\b/i,
    fix: (s) => s.replace(/\breturn back\b/i, "return"),
    c: { category: "naturalness", why: "'Return' already means 'go back', so 'back' is extra.", patternKey: "return_back", patternLabel: "return (not return back)" },
  },
  {
    test: /\b(do|did) the needful\b/i,
    fix: (s) => s.replace(/\b(do|did) the needful\b/i, "take care of it"),
    c: { category: "naturalness", why: "'Do the needful' sounds old-fashioned outside South Asia; 'take care of it' is more natural.", patternKey: "do_the_needful", patternLabel: "do the needful" },
  },
  {
    test: /\bwhat is your good name\b/i,
    fix: (s) => s.replace(/\bwhat is your good name\b/i, "what's your name"),
    c: { category: "naturalness", why: "Just say 'What's your name?' — 'good name' is a direct translation.", patternKey: "good_name", patternLabel: "what's your name" },
  },
  {
    test: /\b(i|we|they|you) (is|was)\b/i,
    fix: (s) => s.replace(/\b(i|we|they|you) (is|was)\b/i, (_m, p: string, v: string) => `${p} ${p.toLowerCase() === "i" ? (v === "is" ? "am" : "was") : v === "is" ? "are" : "were"}`),
    c: { category: "grammar", why: "Match the verb to the subject: I am, you/we/they are.", patternKey: "subject_verb_agreement", patternLabel: "subject–verb agreement" },
  },
];

function perfectSubject(subj: string): string {
  const s = subj.toLowerCase();
  if (s === "i am" || s === "i'm" || s === "am") return "I have";
  if (s === "he is") return "He has";
  if (s === "she is") return "She has";
  if (s === "we are") return "We have";
  if (s === "they are") return "They have";
  return "I have";
}
function thirdPerson(v: string): string {
  if (v === "go") return "goes";
  if (v === "do") return "does";
  if (v === "have") return "has";
  return `${v}s`;
}
function baseForm(v: string): string {
  return ({ went: "go", saw: "see", ate: "eat", came: "come", took: "take", got: "get", made: "make", did: "do" } as Record<string, string>)[v.toLowerCase()] ?? v;
}
function contract(s: string): string {
  return s.replace(/\bI am\b/g, "I'm").replace(/\bI have been\b/g, "I've been").replace(/\bdo not\b/g, "don't").replace(/\bdid not\b/g, "didn't");
}

/** Tiny romanised-Hindi lexicon to demonstrate the native-language bridge offline. */
const HINGLISH: Record<string, string> = {
  main: "I", mai: "I", mujhe: "I", hum: "we", kal: "tomorrow", aaj: "today", office: "office", jaunga: "will go", jaungi: "will go", ghar: "home", khana: "food", khaya: "ate", pasand: "like", hai: "", hoon: "", hu: "", nahi: "not", kya: "what", kaise: "how", acha: "good", accha: "good", bahut: "very", kaam: "work", karta: "do", karti: "do", padhai: "study", school: "school",
};
const HINGLISH_MARKERS = /\b(main|mai|mujhe|hai|hoon|hu|nahi|kya|kaise|jaunga|jaungi|karta|karti|bahut|accha|acha|kal|aaj)\b/i;

function bridge(msg: string): TeacherTurn["nativeBridge"] {
  if (/[ऀ-ॿ]/.test(msg)) {
    return { learnerSaid: msg, english: "(I'll help you say this in English)", tip: "Try saying it in English — even a few words is great. Start with: 'I want to say…'" };
  }
  if (!HINGLISH_MARKERS.test(msg)) return null;
  const words = msg.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/);
  if (words.includes("kal") && words.some((w) => w.startsWith("jaung"))) {
    const place = words.find((w) => ["office", "ghar", "school"].includes(w));
    const where = place === "ghar" ? "home" : place ? `the ${place}` : "there";
    return { learnerSaid: msg, english: `I will go to ${where} tomorrow.`, tip: "'Kal … jaunga' = 'I will go … tomorrow'. 'Will' + verb talks about the future." };
  }
  const guess = words.map((w) => HINGLISH[w] ?? w).filter(Boolean).join(" ");
  return { learnerSaid: msg, english: guess.charAt(0).toUpperCase() + guess.slice(1) + ".", tip: "Good start! Now try the whole sentence in English — I'll help if you get stuck." };
}

const FOLLOW_UPS: Record<string, string[]> = {
  default: ["What do you enjoy most about that?", "Can you tell me a bit more?", "How did that make you feel?", "What happened next?", "Why do you think that is?"],
  interview: ["What would you say is your biggest strength?", "Tell me about a challenge you faced at work and how you handled it.", "Why are you interested in this role?", "Where do you see yourself in three years?", "Do you have any questions for me?"],
  business: ["How do you usually start a meeting with your team?", "What's a project you're proud of?", "How would you politely disagree with a colleague?", "What's the hardest part of your job?"],
  travel: ["What's the first thing you'd do when you land?", "How would you ask for directions to your hotel?", "What would you say at the check-in desk?"],
  assessment: ["What does a normal day look like for you?", "Tell me about something interesting you did last weekend.", "What are your plans for next year?", "Do you think people should learn English at school or online? Why?", "If you could live in any country, where would you live and why?"],
};

export function mockTeacherTurn(req: TeacherRequest): TeacherTurn {
  const msg = req.learnerMessage.trim();
  const words = msg.split(/\s+/).filter(Boolean);
  const corrections: Correction[] = [];
  let fixed = msg;
  for (const r of RULES) {
    if (corrections.length >= 3) break;
    const m = fixed.match(r.test);
    if (!m) continue;
    const before = fixed;
    fixed = r.fix(fixed);
    if (before === fixed) continue;
    const better = capitalize(fixed);
    corrections.push({ ...r.c, youSaid: before, better, moreNatural: r.natural ? r.natural(better) : contract(better) });
  }

  const nativeBridge = bridge(msg);
  const modeKey = req.context.mode.id;
  const pool = FOLLOW_UPS[modeKey] ?? FOLLOW_UPS.default;
  const question = pool[req.context.turnIndex % pool.length];

  let reaction: string;
  let emotion: TeacherTurn["emotion"];
  if (nativeBridge) {
    reaction = `I understand! In English you can say: "${nativeBridge.english}" Can you say that for me?`;
    emotion = "encourage";
  } else if (/\b(haha|lol|funny|joke)\b/i.test(msg)) {
    reaction = "Ha! That's funny.";
    emotion = "laugh";
  } else if (corrections.length) {
    reaction = `Nice! I understand what you mean. A more natural way to say that is: "${corrections[0].moreNatural}"`;
    emotion = "smile";
  } else if (words.length >= 15) {
    reaction = "Wow, that was a really clear and detailed answer!";
    emotion = "impressed";
  } else if (words.length <= 3) {
    reaction = "Good! Let's try a longer answer — even two or three sentences.";
    emotion = "encourage";
  } else {
    reaction = "Great, that sounds very natural.";
    emotion = "smile";
  }

  const sc = req.context.scenario;
  const reply = nativeBridge ? reaction : sc && req.context.turnIndex === 0 ? `${reaction} Now, as ${sc.teacherRole}: ${sc.keyPhrases[0]}?` : `${reaction} ${question}`;

  const base = Math.min(90, 35 + words.length * 3);
  const penalty = corrections.length * 12;
  const g = clamp(base + 10 - penalty);
  const focusKeys = new Set(req.context.focusMistakes.map((f) => f.key));
  const usedCorrectly = /\bfor (two|three|\d+|many|a few|several) (years?|months?)\b/i.test(msg) && focusKeys.has("for_vs_since") ? ["for_vs_since"] : [];

  return {
    reply,
    corrections,
    nativeBridge,
    emotion,
    understoodTeacher: words.length >= 2 && !nativeBridge,
    signals: {
      grammar: g,
      vocabulary: clamp(base),
      fluency: clamp(base - (nativeBridge ? 25 : 0)),
      structure: clamp(g - 5),
      confidence: clamp(30 + words.length * 4),
      complexity: clamp(20 + new Set(words.map((w) => w.toLowerCase())).size * 3),
    },
    newVocabulary: [],
    usedCorrectly,
    goalAchieved: Boolean(sc && req.context.turnIndex >= 4),
    levelEstimate: modeKey === "assessment" && req.context.turnIndex >= 4 ? (base > 75 ? "B2" : base > 60 ? "B1" : base > 45 ? "A2" : "A1") : null,
  };
}

function clamp(n: number): number {
  return Math.max(5, Math.min(95, Math.round(n)));
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
