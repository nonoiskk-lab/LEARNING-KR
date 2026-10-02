import "server-only";
import { db } from "../db";
import { monthlyChurn, mrrCents, paidCount, retention, unitEconomics } from "../analytics/metrics";
import { getMode } from "../config/modes";
import { getScenario } from "../config/scenarios";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function adminDashboard() {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const day30 = iso(d30);

  const [totalUsers, guests, newUsers7, newUsers30, subs, usage30, sessions30, mistakeTop, spend, newPaid30, events30, signups] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isGuest: true } }),
    db.user.count({ where: { createdAt: { gte: d7 } } }),
    db.user.count({ where: { createdAt: { gte: d30 } } }),
    db.subscription.findMany({ select: { plan: true, status: true, mrrCents: true, createdAt: true, canceledAt: true } }),
    db.usageDay.findMany({ where: { day: { gte: day30 } } }),
    db.learningSession.findMany({ where: { startedAt: { gte: d30 }, turns: { gt: 0 } }, select: { mode: true, scenarioId: true, startedAt: true, endedAt: true, speakingSeconds: true } }),
    db.mistakePattern.groupBy({ by: ["label"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 8 }),
    db.marketingSpend.findMany({ where: { month: { gte: day30.slice(0, 7) } } }),
    db.subscription.count({ where: { plan: { not: "free" }, createdAt: { gte: d30 } } }),
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: d30 } }, _count: true }),
    db.user.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 60 * DAY) } }, select: { id: true, createdAt: true } }),
  ]);

  const activeByDay = new Map<string, Set<string>>();
  const activeUsers = new Set<string>();
  const dau = new Map<string, number>();
  let cost = 0, llmIn = 0, llmOut = 0, tts = 0, stt = 0, avatar = 0, speaking = 0;
  for (const u of usage30) {
    if (u.teacherTurns + u.pronunciationDrills > 0) {
      activeUsers.add(u.userId);
      if (!activeByDay.has(u.userId)) activeByDay.set(u.userId, new Set());
      activeByDay.get(u.userId)!.add(u.day);
      dau.set(u.day, (dau.get(u.day) ?? 0) + 1);
    }
    cost += u.costMicroUsd;
    llmIn += u.llmInputTokens;
    llmOut += u.llmOutputTokens;
    tts += u.ttsChars;
    stt += u.sttSeconds;
    avatar += u.avatarSeconds;
    speaking += u.speakingSeconds;
  }
  const aiCostCents30d = cost / 10_000;
  const paid = paidCount(subs);
  const churn = monthlyChurn(subs, now);
  const econ = unitEconomics({
    mrrCents: mrrCents(subs),
    totalUsers,
    paidUsers: paid,
    monthlyChurn: churn,
    aiCostCents30d,
    activeUsers30d: activeUsers.size,
    marketingSpendCents30d: spend.reduce((a, s) => a + s.cents, 0),
    newPaidUsers30d: newPaid30,
  });

  const cohort = signups.map((u) => ({ signupDay: iso(u.createdAt), activeDays: activeByDay.get(u.id) ?? new Set<string>() }));

  const lessonCounts = new Map<string, number>();
  for (const s of sessions30) {
    const key = s.scenarioId ? getScenario(s.scenarioId)?.title ?? s.scenarioId : getMode(s.mode).title;
    lessonCounts.set(key, (lessonCounts.get(key) ?? 0) + 1);
  }
  const durations = sessions30.filter((s) => s.endedAt).map((s) => (s.endedAt!.getTime() - s.startedAt.getTime()) / 60000);

  const dauSeries = Array.from({ length: 30 }, (_, i) => {
    const d = iso(new Date(now.getTime() - (29 - i) * DAY));
    return { day: d, users: dau.get(d) ?? 0 };
  });

  return {
    users: { total: totalUsers, guests, registered: totalUsers - guests, new7: newUsers7, new30: newUsers30, active30: activeUsers.size, free: totalUsers - paid, paid },
    planMix: ["free", "premium", "pro"].map((p) => ({ plan: p, count: p === "free" ? totalUsers - paid : subs.filter((s) => s.plan === p && s.status !== "canceled").length })),
    econ: { ...econ, churn },
    engagement: {
      avgSessionMinutes: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      speakingMinutes: speaking / 60,
      sessions: sessions30.length,
      d1: retention(cohort, 1),
      d7: retention(cohort, 7),
      d30: retention(cohort, 30),
    },
    usage: { avatarMinutes: avatar / 60, voiceMinutes: stt / 60, ttsChars: tts, llmInputTokens: llmIn, llmOutputTokens: llmOut, aiCostUsd: aiCostCents30d / 100 },
    topLessons: [...lessonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    topMistakes: mistakeTop.map((m) => ({ label: m.label, count: m._sum.count ?? 0 })),
    funnel: Object.fromEntries(events30.map((e) => [e.name, e._count])) as Record<string, number>,
    dauSeries,
  };
}
