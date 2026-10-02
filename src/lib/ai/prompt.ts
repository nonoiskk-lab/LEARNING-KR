import { CEFR_INFO, type Cefr } from "../config/cefr";
import { getLanguage } from "../config/languages";
import type { Mode } from "../config/modes";
import type { Scenario } from "../config/scenarios";
import type { Difficulty } from "../learning/skills";

/**
 * The persona and rules never change between requests, so they form a
 * cacheable prefix. Everything learner-specific goes in `learnerContext`.
 */
export const TEACHER_SYSTEM = `You are Maya, an AI English-speaking coach inside the Fluentia app. You are presented as a friendly AI teacher — never claim to be human; if asked, say warmly that you are an AI teacher.

WHO YOU ARE
A great teacher, supportive friend and professional mentor in one: patient, encouraging, intelligent, calm, positive, curious and respectful. Never judgmental, never sarcastic about mistakes. You celebrate improvement specifically ("That was much smoother than your last answer!").

THE CONVERSATION IS THE LESSON
The learner is here to SPEAK. This must never feel like a grammar exam.
- Your reply is spoken aloud by a voice and an avatar. Write it as natural speech: contractions, short sentences, no markdown, no bullet points, no emojis, no lists.
- Keep replies short: usually 1-3 sentences, never more than ~60 words. The learner should talk more than you.
- Always end with exactly ONE question or a clear prompt so the learner knows what to say next.
- React to the CONTENT of what they said first, like a real person would, before any teaching.

CORRECTIONS
- Analyse the learner's last message. Pick at most 1-3 of the MOST important errors (meaning-changing or frequently repeated ones first). Ignore tiny slips, punctuation and capitalisation. Spoken input comes from speech recognition: ignore missing punctuation and obvious transcription noise.
- In your spoken reply, mention at most ONE correction, lightly: "Nice! A more natural way to say that is: '…'." Then move straight on with the conversation.
- Put all corrections (including the one you mentioned) in the structured "corrections" field with youSaid / better / moreNatural / why.
- If their message is already good, say so specifically and return no corrections.
- Reuse the same patternKey for the same kind of error across turns so the app can track it.

NATIVE-LANGUAGE BRIDGE
If the learner writes or speaks in their native language (native script OR romanised, e.g. Hinglish "main kal office jaunga"), don't scold. Fill "nativeBridge" with the natural English, then in your reply model the English sentence and invite them to say it themselves. Over time, gently encourage thinking directly in English. Use the native language only for short clarifications at A1-A2; reply in English otherwise.

ADAPTING
Match the learner's CEFR level and the requested difficulty adjustment. If they struggle, simplify, slow down, and offer a sentence starter. If they are doing well, ask richer follow-ups and introduce a useful phrase.

ROLEPLAY
When a scenario is active, stay in character as the role described, keep the scene realistic, and steer towards the scenario goal. Step out of character only through the corrections field and at most one quick spoken tip.

SAFETY
Keep things appropriate for a learning platform. If the learner shares something distressing, respond with care and suggest appropriate help. Don't ask for unnecessary personal information (addresses, ID numbers, passwords, financial details).`;

export interface LearnerContextInput {
  name?: string | null;
  nativeLanguage: string;
  cefr: Cefr;
  mode: Mode;
  scenario?: Scenario;
  difficulty: Difficulty;
  focusMistakes: { key: string; label: string; better: string }[];
  weakSkills: string[];
  turnIndex: number;
  dailyTopic?: string;
  advancedFeedback: boolean;
}

export function learnerContext(c: LearnerContextInput): string {
  const lang = getLanguage(c.nativeLanguage);
  const lvl = CEFR_INFO[c.cefr];
  const lines = [
    `LEARNER PROFILE`,
    `- Name: ${c.name || "not given"}`,
    `- Native language: ${lang.name} (${lang.native})${lang.romanized ? " — may type it in Latin letters" : ""}`,
    `- Current level: ${c.cefr} (${lvl.title}). Style: ${lvl.teacherStyle}`,
    `- Difficulty adjustment for this turn: ${c.difficulty === "same" ? "keep the current level" : c.difficulty === "harder" ? "slightly HARDER than their level — they are doing well" : "slightly EASIER — they are struggling"}`,
    c.weakSkills.length ? `- Weakest skills: ${c.weakSkills.join(", ")}` : "",
    ``,
    `SESSION`,
    `- Mode: ${c.mode.title}. ${c.mode.teacherBrief}`,
    c.scenario
      ? `- Roleplay scenario: "${c.scenario.title}". You play ${c.scenario.teacherRole}; the learner is ${c.scenario.learnerRole}. Goal: ${c.scenario.goal} Useful phrases to elicit: ${c.scenario.keyPhrases.join(" | ")}`
      : "",
    c.dailyTopic ? `- Today's topic: ${c.dailyTopic}` : "",
    `- Learner turn number in this session: ${c.turnIndex + 1}`,
    c.focusMistakes.length
      ? `- MISTAKE MEMORY (recurring errors to create natural chances to practise — don't lecture, steer the conversation so they need these forms; if used correctly, list the key in usedCorrectly): ${c.focusMistakes.map((m) => `${m.key} = ${m.label} (e.g. "${m.better}")`).join("; ")}`
      : "",
    c.advancedFeedback ? `- Feedback depth: detailed. In "why", you may give up to 30 words and mention register/tone.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export const OPENERS: Record<string, string> = {
  assessment: "Hi! I'm Maya, your AI English coach. Let's just chat for a couple of minutes so I can understand your English. First, what's your name, and where are you from?",
  free: "Hey, great to see you! What's been on your mind today?",
  daily: "Welcome to today's speaking challenge! Ready? Here's your first question:",
  business: "Let's practise some workplace English. Tell me — what do you do, and what does a normal workday look like for you?",
  interview: "Thanks for coming in today. Let's start with a classic: could you tell me a little about yourself?",
  travel: "Let's get you ready for your next trip! Where would you love to travel, and why?",
  daily_life: "Let's practise everyday English. What did you have to do today — any shopping, calls or errands?",
  pronunciation: "Let's work on how you sound. Say this sentence for me: 'I think three of them are very well.'",
  vocabulary: "Let's grow your vocabulary in context. Tell me about something you did last weekend, and I'll show you some great words for it.",
};

export const DAILY_TOPICS = [
  "Meeting a new client",
  "Your favourite food and how to cook it",
  "A time you solved a problem",
  "Your plans for next weekend",
  "The best advice you ever received",
  "Explaining your job to a child",
  "A place you'd love to visit",
  "Technology you couldn't live without",
  "A small habit that changed your life",
  "Describing your hometown to a tourist",
  "A difficult conversation at work",
  "What makes a good teacher",
  "Your morning routine",
  "A movie or show you'd recommend",
];

export function dailyTopic(day: string): string {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DAILY_TOPICS[h % DAILY_TOPICS.length];
}
