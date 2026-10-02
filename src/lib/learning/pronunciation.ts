/**
 * Pronunciation scoring for the Listen → Repeat → Analyse loop.
 *
 * Works with any speech-to-text engine: we align what the recogniser heard
 * against the target sentence word-by-word. Words the recogniser could not
 * match are the ones the learner most likely mispronounced. When the STT
 * provider returns per-word confidence (Deepgram, Azure Pronunciation
 * Assessment, etc.) that is blended in.
 */
export interface WordResult {
  target: string;
  heard: string | null;
  status: "good" | "close" | "missed";
}

export interface PronunciationResult {
  score: number; // 0-100
  words: WordResult[];
  tips: string[];
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Needleman–Wunsch style word alignment. */
export function alignWords(target: string[], heard: string[]): WordResult[] {
  const n = target.length;
  const m = heard.length;
  const GAP = -0.6;
  const score = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) score[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) score[0][j] = j * GAP;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sim = similarity(target[i - 1], heard[j - 1]);
      score[i][j] = Math.max(score[i - 1][j - 1] + (sim * 2 - 1), score[i - 1][j] + GAP, score[i][j - 1] + GAP);
    }
  const out: WordResult[] = [];
  let i = n;
  let j = m;
  while (i > 0) {
    if (j > 0) {
      const sim = similarity(target[i - 1], heard[j - 1]);
      if (Math.abs(score[i][j] - (score[i - 1][j - 1] + (sim * 2 - 1))) < 1e-9) {
        out.push({ target: target[i - 1], heard: heard[j - 1], status: sim === 1 ? "good" : sim >= 0.6 ? "close" : "missed" });
        i--;
        j--;
        continue;
      }
      if (Math.abs(score[i][j] - (score[i][j - 1] + GAP)) < 1e-9) {
        j--;
        continue;
      }
    }
    out.push({ target: target[i - 1], heard: null, status: "missed" });
    i--;
  }
  return out.reverse();
}

/** Common L1-specific pronunciation pitfalls used to generate tips. */
const L1_HINTS: Record<string, { test: RegExp; tip: string }[]> = {
  hi: [
    { test: /\bv|w/, tip: "V vs W: for V, touch your top teeth to your lower lip (very). For W, round your lips (water)." },
    { test: /th/, tip: "TH: put your tongue lightly between your teeth and blow air (think, three)." },
    { test: /^s[ptk]/, tip: "Don't add a vowel before S-clusters: say 'school', not 'iss-school'." },
  ],
  ja: [
    { test: /[rl]/, tip: "R vs L: for L touch the ridge behind your teeth; for R pull your tongue back without touching." },
    { test: /[^aeiou]$/, tip: "Don't add a vowel after final consonants: 'desk', not 'desuku'." },
  ],
  ko: [{ test: /[fp]/, tip: "F vs P: F is made with teeth on lip and continuous air; P is a short pop with both lips." }],
  es: [
    { test: /^s[ptkcm]/, tip: "No 'e' before S-clusters: 'speak', not 'espeak'." },
    { test: /[bv]/, tip: "B vs V: V needs your top teeth on your lower lip." },
  ],
  ar: [{ test: /p/, tip: "P vs B: P has no voice — feel a puff of air on your hand (pen vs Ben)." }],
  de: [{ test: /w/, tip: "English W is rounded lips, not the German W sound (water, not 'vater')." }],
  fr: [{ test: /^h/, tip: "Pronounce the H: breathe out softly (house, hotel)." }, { test: /th/, tip: "TH: tongue between teeth (this, think)." }],
};

export function scorePronunciation(target: string, heard: string, opts: { nativeLanguage?: string; sttConfidence?: number } = {}): PronunciationResult {
  const words = alignWords(tokenize(target), tokenize(heard));
  if (!words.length) return { score: 0, words, tips: [] };
  const raw = words.reduce((acc, w) => acc + (w.status === "good" ? 1 : w.status === "close" ? 0.6 : 0), 0) / words.length;
  let score = raw * 100;
  if (typeof opts.sttConfidence === "number" && opts.sttConfidence > 0) score = score * 0.75 + opts.sttConfidence * 100 * 0.25;
  const tips: string[] = [];
  const problem = words.filter((w) => w.status !== "good").map((w) => w.target);
  const hints = L1_HINTS[opts.nativeLanguage ?? ""] ?? [];
  for (const h of hints) if (problem.some((p) => h.test.test(p)) && !tips.includes(h.tip)) tips.push(h.tip);
  if (problem.length && !tips.length) tips.push(`Focus on: ${problem.slice(0, 3).map((p) => `"${p}"`).join(", ")}. Listen once more, then say it slowly before speeding up.`);
  return { score: Math.round(score), words, tips: tips.slice(0, 2) };
}
