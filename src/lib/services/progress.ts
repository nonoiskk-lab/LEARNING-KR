import "server-only";
import { db } from "../db";
import { getSkills } from "./learning";
import { overallScore } from "../learning/skills";
import { levelFromXp } from "../learning/gamification";
import { CEFR_INFO, cefrThreshold, nextCefr, type Cefr } from "../config/cefr";
import { ACHIEVEMENTS } from "../config/achievements";

const DAY = 86_400_000;

export async function progressSnapshot(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const since = new Date(Date.now() - 7 * DAY);
  const [skills, totals, lessons, week, mistakes, achievements, vocab, recent] = await Promise.all([
    getSkills(userId),
    db.learningSession.aggregate({ where: { userId }, _sum: { speakingSeconds: true, wordsSpoken: true } }),
    db.learningSession.count({ where: { userId, endedAt: { not: null }, turns: { gt: 0 } } }),
    db.usageDay.findMany({ where: { userId, day: { gte: since.toISOString().slice(0, 10) } }, orderBy: { day: "asc" } }),
    db.mistakePattern.findMany({ where: { userId }, orderBy: [{ mastered: "asc" }, { count: "desc" }], take: 6 }),
    db.userAchievement.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" } }),
    db.vocabularyItem.count({ where: { userId } }),
    db.learningSession.findMany({ where: { userId, turns: { gt: 0 } }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const overall = overallScore(skills.map);
  const level = user.cefrLevel as Cefr;
  const next = nextCefr(level);
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY).toISOString().slice(0, 10);
    const row = week.find((w) => w.day === d);
    return { day: d, minutes: Math.round(((row?.speakingSeconds ?? 0) / 60) * 10) / 10, turns: row?.teacherTurns ?? 0 };
  });
  const unlocked = new Set(achievements.map((a) => a.achievement));
  return {
    user: { name: user.name, isGuest: user.isGuest, nativeLanguage: user.nativeLanguage, streakDays: user.streakDays, xp: user.xp },
    xpLevel: levelFromXp(user.xp),
    skills: skills.map,
    overall,
    level,
    levelInfo: CEFR_INFO[level] ?? CEFR_INFO.A2,
    nextLevel: next,
    nextLevelProgress: next ? Math.min(1, overall / cefrThreshold(level)) : 1,
    speakingMinutes: Math.round((totals._sum.speakingSeconds ?? 0) / 60),
    wordsSpoken: totals._sum.wordsSpoken ?? 0,
    lessonsCompleted: lessons,
    vocabulary: vocab,
    weekly,
    mistakes: mistakes.map((m) => ({ key: m.key, label: m.label, example: m.example, better: m.better, count: m.count, mastered: m.mastered })),
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, title: a.title, description: a.description, icon: a.icon, unlocked: unlocked.has(a.id) })),
    recent: recent.map((s) => ({ id: s.id, mode: s.mode, scenarioId: s.scenarioId, startedAt: s.startedAt.toISOString(), turns: s.turns, xp: s.xpEarned })),
  };
}

export type ProgressSnapshot = Awaited<ReturnType<typeof progressSnapshot>>;
