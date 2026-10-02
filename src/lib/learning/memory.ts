/**
 * Mistake memory with spaced repetition (SM-2 inspired).
 * Every correction carries a stable `patternKey` (e.g. "for_vs_since"); repeated
 * patterns are scheduled for review and woven into future lessons until mastered.
 */
export interface ReviewState {
  ease: number;
  intervalDays: number;
  count: number;
}

const DAY = 86_400_000;

/** The learner made this mistake again: reset interval, make it harder. */
export function onMistakeRepeated(s: ReviewState, now = new Date()): ReviewState & { dueAt: Date } {
  const ease = Math.max(1.3, s.ease - 0.2);
  return { ease, intervalDays: 1, count: s.count + 1, dueAt: new Date(now.getTime() + DAY) };
}

/** The learner used the correct form when it came up: push the next review out. */
export function onUsedCorrectly(s: ReviewState, now = new Date()): ReviewState & { dueAt: Date; mastered: boolean } {
  const ease = Math.min(3.0, s.ease + 0.1);
  const intervalDays = Math.max(1, Math.round(s.intervalDays * ease));
  return { ease, intervalDays, count: s.count, dueAt: new Date(now.getTime() + intervalDays * DAY), mastered: intervalDays >= 21 };
}

export function normalizePatternKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "general";
}

export interface MemoryItem {
  key: string;
  label: string;
  example: string;
  better: string;
  count: number;
  dueAt: Date;
  mastered: boolean;
}

/** Pick what the teacher should weave into this session: due first, then most frequent. */
export function selectFocus(items: MemoryItem[], now = new Date(), max = 3): MemoryItem[] {
  return items
    .filter((i) => !i.mastered)
    .sort((a, b) => {
      const ad = a.dueAt <= now ? 1 : 0;
      const bd = b.dueAt <= now ? 1 : 0;
      if (ad !== bd) return bd - ad;
      return b.count - a.count;
    })
    .slice(0, max);
}
