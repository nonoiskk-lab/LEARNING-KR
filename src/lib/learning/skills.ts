/**
 * Skill model. Each skill is a 0-100 estimate updated with an exponential
 * moving average whose step size shrinks as evidence accumulates, so early
 * sessions move the needle quickly and later ones refine it.
 */
export const SKILLS = ["speaking", "grammar", "vocabulary", "pronunciation", "fluency", "confidence", "listening"] as const;
export type Skill = (typeof SKILLS)[number];
export type SkillMap = Record<Skill, number>;

export const SKILL_LABELS: Record<Skill, string> = {
  speaking: "Speaking",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  fluency: "Fluency",
  confidence: "Confidence",
  listening: "Listening",
};

export const DEFAULT_SCORE = 40;

export function defaultSkills(seed = DEFAULT_SCORE): SkillMap {
  return Object.fromEntries(SKILLS.map((s) => [s, seed])) as SkillMap;
}

/** Learning rate: 0.5 for the first sample, decaying towards 0.08. */
export function learningRate(samples: number): number {
  return Math.max(0.08, 0.5 / Math.sqrt(samples + 1));
}

export function updateSkill(current: number, observation: number, samples: number): number {
  const obs = clamp(observation, 0, 100);
  const next = current + learningRate(samples) * (obs - current);
  return round1(clamp(next, 0, 100));
}

/** Weighted overall used for CEFR placement. Pronunciation/listening weigh less: noisier signals. */
export function overallScore(s: Partial<SkillMap>): number {
  const w: SkillMap = { speaking: 1.2, grammar: 1.2, vocabulary: 1.1, pronunciation: 0.8, fluency: 1.1, confidence: 0.6, listening: 0.7 };
  let sum = 0;
  let wsum = 0;
  for (const k of SKILLS) {
    const v = s[k];
    if (typeof v === "number") {
      sum += v * w[k];
      wsum += w[k];
    }
  }
  return wsum ? round1(sum / wsum) : DEFAULT_SCORE;
}

export interface TurnSignals {
  grammar: number;
  vocabulary: number;
  fluency: number;
  structure: number;
  confidence: number;
  complexity: number;
  /** speech-only signals */
  pronunciation?: number;
  wordsPerMinute?: number;
  understoodTeacher?: boolean;
}

/**
 * Convert one turn's signals into skill observations. Speaking is a blend of
 * the productive skills; listening is inferred from whether the learner's
 * reply actually answered the teacher.
 */
export function observationsFromTurn(t: TurnSignals): Partial<SkillMap> {
  const obs: Partial<SkillMap> = {
    grammar: t.grammar,
    vocabulary: (t.vocabulary * 2 + t.complexity) / 3,
    fluency: t.wordsPerMinute ? (t.fluency + wpmScore(t.wordsPerMinute)) / 2 : t.fluency,
    confidence: t.confidence,
    speaking: (t.grammar + t.vocabulary + t.fluency + t.structure) / 4,
  };
  if (typeof t.pronunciation === "number") obs.pronunciation = t.pronunciation;
  if (typeof t.understoodTeacher === "boolean") obs.listening = t.understoodTeacher ? 75 : 35;
  return obs;
}

/** 130-160 wpm is natural conversational English; below 60 is very halting. */
export function wpmScore(wpm: number): number {
  if (wpm <= 0) return 0;
  if (wpm >= 130) return wpm > 200 ? 80 : 95;
  return round1(clamp(((wpm - 30) / 100) * 95, 5, 95));
}

export type Difficulty = "easier" | "same" | "harder";

/**
 * Adaptive difficulty from the most recent turn scores (newest last).
 * Three strong turns in a row → harder; two weak → easier.
 */
export function nextDifficulty(recentTurnScores: number[]): Difficulty {
  const last3 = recentTurnScores.slice(-3);
  const last2 = recentTurnScores.slice(-2);
  if (last2.length === 2 && last2.every((s) => s < 45)) return "easier";
  if (last3.length === 3 && last3.every((s) => s >= 75)) return "harder";
  return "same";
}

export function turnScore(t: TurnSignals): number {
  return round1((t.grammar + t.vocabulary + t.fluency + t.structure + t.complexity) / 5);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
