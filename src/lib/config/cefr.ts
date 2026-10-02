export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR)[number];

export const CEFR_INFO: Record<Cefr, { title: string; focus: string; teacherStyle: string }> = {
  A1: {
    title: "Basic sentences",
    focus: "introductions, present simple, everyday nouns",
    teacherStyle: "Use very short sentences (max 8 words), common words only, speak slowly, one question at a time. Offer a model answer the learner can copy.",
  },
  A2: {
    title: "Daily conversations",
    focus: "past simple, future plans, shopping, directions",
    teacherStyle: "Short sentences, everyday vocabulary, simple questions. Give a sentence starter when the learner hesitates.",
  },
  B1: {
    title: "Fluency building",
    focus: "present perfect, opinions, connecting ideas, storytelling",
    teacherStyle: "Natural pace, ask follow-up 'why/how' questions, introduce one useful phrase per turn.",
  },
  B2: {
    title: "Professional communication",
    focus: "meetings, presentations, conditionals, polite disagreement",
    teacherStyle: "Natural speed, idiomatic but clear language, push for longer and more structured answers.",
  },
  C1: {
    title: "Advanced natural English",
    focus: "nuance, register, phrasal verbs, persuasive speech",
    teacherStyle: "Speak like a native colleague; focus feedback on naturalness, register and precision.",
  },
  C2: {
    title: "High-level communication",
    focus: "rhetoric, humour, cultural references, precision under pressure",
    teacherStyle: "Full native complexity; only flag subtle naturalness or register issues.",
  },
};

export function cefrIndex(level: string): number {
  const i = CEFR.indexOf(level as Cefr);
  return i < 0 ? 1 : i;
}

export function nextCefr(level: string): Cefr | null {
  const i = cefrIndex(level);
  return i >= CEFR.length - 1 ? null : CEFR[i + 1];
}

/** Map a 0-100 overall score to a CEFR band. */
export function cefrFromScore(score: number): Cefr {
  if (score < 25) return "A1";
  if (score < 40) return "A2";
  if (score < 55) return "B1";
  if (score < 70) return "B2";
  if (score < 85) return "C1";
  return "C2";
}

/** The score at which a learner graduates from `level` to the next band. */
export function cefrThreshold(level: string): number {
  return [25, 40, 55, 70, 85, 100][cefrIndex(level)];
}
