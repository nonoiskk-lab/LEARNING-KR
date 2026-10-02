/** XP, levels and streaks. Levels follow a gentle quadratic curve. */

export const XP_RULES = {
  turnSpoken: 10,
  turnTyped: 6,
  correctionApplied: 5,
  sessionComplete: 25,
  dailyChallenge: 50,
  pronunciationPass: 8,
  roleplayGoal: 40,
};

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return Math.round(50 * (level - 1) * (level + 2));
}

export function levelFromXp(xp: number): { level: number; current: number; needed: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - base, needed: next - base, progress: (xp - base) / (next - base) };
}

export function dayKey(d = new Date(), timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Update a streak given the last active day and today (both YYYY-MM-DD). */
export function nextStreak(lastActiveDay: string | null, today: string, streak: number): number {
  if (!lastActiveDay) return 1;
  if (lastActiveDay === today) return Math.max(1, streak);
  const diff = Math.round((Date.parse(today) - Date.parse(lastActiveDay)) / 86_400_000);
  return diff === 1 ? streak + 1 : 1;
}

export function turnXp(inputMode: "speak" | "type", wordCount: number): number {
  const base = inputMode === "speak" ? XP_RULES.turnSpoken : XP_RULES.turnTyped;
  // reward longer answers, capped, to encourage speaking more
  return base + Math.min(10, Math.floor(wordCount / 8));
}
