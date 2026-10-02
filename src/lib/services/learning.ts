import "server-only";
import { db, parseJson } from "../db";
import { teacherTurn, type HistoryItem } from "../ai/teacher";
import { OPENERS, dailyTopic } from "../ai/prompt";
import type { Correction, TeacherTurn } from "../ai/schema";
import { getMode, type ModeId } from "../config/modes";
import { getScenario } from "../config/scenarios";
import { cefrFromScore, cefrIndex, CEFR, type Cefr } from "../config/cefr";
import { ACHIEVEMENTS, type AchievementStats } from "../config/achievements";
import { SKILLS, defaultSkills, nextDifficulty, observationsFromTurn, overallScore, turnScore, updateSkill, type Skill, type SkillMap } from "../learning/skills";
import { normalizePatternKey, onMistakeRepeated, onUsedCorrectly, selectFocus } from "../learning/memory";
import { XP_RULES, dayKey, nextStreak, turnXp } from "../learning/gamification";
import { checkLimit, effectivePlan, hasFeature, upgradeMessage } from "../billing/entitlements";
import { addUsage, todayUsage } from "../billing/usage";
import { track } from "../analytics/track";
import type { CurrentUser } from "../auth";

export class LimitError extends Error {
  constructor(public kind: string, public upgrade: { title: string; body: string }) {
    super(upgrade.title);
  }
}

export async function getSkills(userId: string): Promise<{ map: SkillMap; samples: Record<string, number> }> {
  const rows = await db.skillScore.findMany({ where: { userId } });
  const map = defaultSkills();
  const samples: Record<string, number> = {};
  for (const r of rows) {
    if ((SKILLS as readonly string[]).includes(r.skill)) {
      map[r.skill as Skill] = r.score;
      samples[r.skill] = r.samples;
    }
  }
  return { map, samples };
}

export async function startSession(user: CurrentUser, modeId: string, scenarioId?: string | null) {
  const mode = getMode(modeId);
  const scenario = getScenario(scenarioId);
  const plan = effectivePlan(user.subscription);

  const required = scenario?.requires ?? mode.requires;
  if (!hasFeature(plan, required)) throw new LimitError("feature", upgradeMessage("feature", required));

  const usage = await todayUsage(user.id);
  if (mode.id !== "assessment") {
    const c = checkLimit(plan, usage, "conversation");
    if (!c.ok) throw new LimitError("conversation", upgradeMessage("conversation"));
    if (scenario) {
      const r = checkLimit(plan, usage, "roleplay");
      if (!r.ok) throw new LimitError("roleplay", upgradeMessage("roleplay"));
    }
  }

  const opener = scenario
    ? `Let's step into the scene: ${scenario.title}. I'll be ${scenario.teacherRole}, and you're ${scenario.learnerRole}. Your goal: ${scenario.goal} Ready? ${roleplayOpener(scenario.id)}`
    : mode.id === "daily"
      ? `${OPENERS.daily} ${dailyTopic(dayKey())} — what comes to mind?`
      : OPENERS[mode.id] ?? OPENERS.free;

  const session = await db.learningSession.create({
    data: {
      userId: user.id,
      mode: scenario ? "roleplay" : mode.id,
      scenarioId: scenario?.id,
      messages: { create: { role: "teacher", text: opener, emotion: "smile" } },
    },
    include: { messages: true },
  });

  await addUsage(user.id, { conversations: mode.id === "assessment" ? 0 : 1, roleplays: scenario ? 1 : 0 });
  await track("session_start", user.id, { mode: session.mode, scenario: scenario?.id });
  return session;
}

function roleplayOpener(id: string): string {
  const lines: Record<string, string> = {
    "order-food": "Good evening, welcome! Here's the menu. Can I get you something to drink first?",
    "airport-checkin": "Good morning! Can I see your passport and ticket, please?",
    immigration: "Next, please. Passport? And what's the purpose of your visit?",
    hotel: "Good afternoon, welcome to the Grand. Do you have a reservation?",
    taxi: "Hi there, where are you headed?",
    directions: "Oh, hi! You look a bit lost — can I help you?",
    shopping: "Hi! Are you looking for anything in particular today?",
    "job-interview": "Thanks for coming in. So, tell me about yourself.",
    "self-intro": "Welcome. Let's begin — please introduce yourself.",
    "hr-interview": "Hi, thanks for your time today. So, why are you looking for a change?",
    salary: "We're happy to make you an offer. The base salary would be 60,000. What do you think?",
    negotiation: "So, as discussed, our price is 12 dollars per unit with delivery in six weeks.",
    "client-meeting": "Hi, nice to finally meet in person! So, where would you like to start?",
    "customer-support": "Finally! I've been waiting for twenty minutes. My order still hasn't arrived!",
    complaint: "I have to be honest, we're very unhappy with the last delivery.",
  };
  return lines[id] ?? "Let's begin — you start!";
}

export interface TurnInput {
  sessionId: string;
  text: string;
  inputMode: "speak" | "type";
  sttConfidence?: number;
  speakingSeconds?: number;
}

export interface TurnOutput {
  teacher: TeacherTurn;
  messageId: string;
  xpGained: number;
  totalXp: number;
  streakDays: number;
  achievements: { id: string; title: string; icon: string }[];
  difficulty: "easier" | "same" | "harder";
  levelUp: Cefr | null;
  provider: string;
  remainingTurns: number | null;
}

export async function processTurn(user: CurrentUser, input: TurnInput): Promise<TurnOutput> {
  const text = input.text.trim().slice(0, 2000);
  if (!text) throw new Error("Empty message");

  const session = await db.learningSession.findFirst({
    where: { id: input.sessionId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new Error("Session not found");

  const plan = effectivePlan(user.subscription);
  const usage = await todayUsage(user.id);
  const lim = checkLimit(plan, usage, "turn");
  if (!lim.ok) throw new LimitError("turn", upgradeMessage("turn"));

  const mode = getMode(session.scenarioId ? "roleplay" : session.mode);
  const scenario = getScenario(session.scenarioId);
  const { map: skills, samples } = await getSkills(user.id);

  // Mistakes are recorded for everyone; steering lessons around them is a premium feature.
  const mistakeRows = await db.mistakePattern.findMany({ where: { userId: user.id, mastered: false }, orderBy: { count: "desc" }, take: 20 });
  const focus = hasFeature(plan, "mistake_memory") ? selectFocus(mistakeRows) : [];

  const learnerTurns = session.messages.filter((m) => m.role === "user");
  const recentScores = learnerTurns.map((m) => m.score ?? 50);
  const difficulty = nextDifficulty(recentScores);
  const weakSkills = [...SKILLS].sort((a, b) => skills[a] - skills[b]).slice(0, 2);

  const history: HistoryItem[] = session.messages.map((m) => ({ role: m.role === "user" ? "user" : "teacher", text: m.text }));

  const result = await teacherTurn({
    context: {
      name: user.name,
      nativeLanguage: user.nativeLanguage,
      cefr: (CEFR as readonly string[]).includes(user.cefrLevel) ? (user.cefrLevel as Cefr) : "A2",
      mode,
      scenario,
      difficulty,
      focusMistakes: focus.map((f) => ({ key: f.key, label: f.label, better: f.better })),
      weakSkills,
      turnIndex: learnerTurns.length,
      dailyTopic: session.mode === "daily" ? dailyTopic(dayKey()) : undefined,
      advancedFeedback: hasFeature(plan, "advanced_feedback"),
    },
    history,
    learnerMessage: text,
    inputMode: input.inputMode,
    sttConfidence: input.sttConfidence,
  });
  const t = result.turn;

  // --- ANALYZE: turn signals → skills ---
  const words = text.split(/\s+/).filter(Boolean).length;
  const seconds = input.inputMode === "speak" ? Math.max(1, Math.round(input.speakingSeconds ?? words / 2)) : 0;
  const wpm = seconds ? (words / seconds) * 60 : undefined;
  const pronunciation =
    input.inputMode === "speak" && typeof input.sttConfidence === "number" && input.sttConfidence > 0
      ? Math.max(0, Math.min(100, input.sttConfidence * 100 - t.corrections.filter((c) => c.category === "pronunciation").length * 10))
      : undefined;
  const signals = { ...t.signals, pronunciation, wordsPerMinute: wpm, understoodTeacher: t.understoodTeacher };
  const obs = observationsFromTurn(signals);
  const score = turnScore(signals);

  const newSkills: SkillMap = { ...skills };
  await db.$transaction(
    Object.entries(obs).map(([skill, value]) => {
      const n = samples[skill] ?? 0;
      const next = updateSkill(skills[skill as Skill], value as number, n);
      newSkills[skill as Skill] = next;
      return db.skillScore.upsert({
        where: { userId_skill: { userId: user.id, skill } },
        create: { userId: user.id, skill, score: next, samples: 1 },
        update: { score: next, samples: { increment: 1 } },
      });
    }),
  );

  // --- STORE messages ---
  await db.message.create({ data: { sessionId: session.id, role: "user", inputMode: input.inputMode, text, score } });
  const teacherMsg = await db.message.create({
    data: { sessionId: session.id, role: "teacher", text: t.reply, emotion: t.emotion, corrections: JSON.stringify({ corrections: t.corrections, nativeBridge: t.nativeBridge, newVocabulary: t.newVocabulary }) },
  });

  // --- REMEMBER: mistake memory + vocabulary ---
  await rememberCorrections(user.id, t.corrections);
  for (const key of t.usedCorrectly) {
    const row = mistakeRows.find((m) => m.key === normalizePatternKey(key));
    if (!row) continue;
    const next = onUsedCorrectly(row);
    await db.mistakePattern.update({ where: { id: row.id }, data: { ease: next.ease, intervalDays: next.intervalDays, dueAt: next.dueAt, mastered: next.mastered } });
  }
  for (const v of t.newVocabulary.slice(0, 2)) {
    const word = v.word.trim().toLowerCase().slice(0, 60);
    if (!word) continue;
    await db.vocabularyItem.upsert({
      where: { userId_word: { userId: user.id, word } },
      create: { userId: user.id, word, meaning: v.meaning, example: v.example },
      update: { timesUsed: { increment: 1 } },
    });
  }

  // --- MOTIVATE: XP, streak, level ---
  let xp = turnXp(input.inputMode, words);
  if (t.goalAchieved && scenario && !session.summary) xp += XP_RULES.roleplayGoal;
  const today = dayKey();
  const streakDays = nextStreak(user.lastActiveDay, today, user.streakDays);

  let cefr = user.cefrLevel;
  let levelUp: Cefr | null = null;
  if (session.mode === "assessment" && t.levelEstimate) {
    cefr = t.levelEstimate;
  } else {
    const est = cefrFromScore(overallScore(newSkills));
    const totalSamples = Object.values(samples).reduce((a, b) => a + b, 0);
    // promote one band at a time, and only with enough evidence
    if (cefrIndex(est) > cefrIndex(cefr) && totalSamples >= 40) {
      cefr = CEFR[cefrIndex(cefr) + 1];
      levelUp = cefr as Cefr;
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { xp: { increment: xp }, streakDays, lastActiveDay: today, cefrLevel: cefr },
  });
  await db.learningSession.update({
    where: { id: session.id },
    data: { turns: { increment: 1 }, wordsSpoken: { increment: words }, speakingSeconds: { increment: seconds }, xpEarned: { increment: xp }, ...(t.goalAchieved ? { summary: JSON.stringify({ goalAchieved: true }) } : {}) },
  });

  const avatarSeconds = Math.round(t.reply.split(/\s+/).length / 2.5); // ~150 wpm speaking
  await addUsage(user.id, {
    teacherTurns: 1,
    speakingSeconds: seconds,
    sttSeconds: seconds,
    avatarSeconds,
    ttsChars: t.reply.length,
    llmInputTokens: result.usage.inputTokens + result.usage.cacheReadTokens + result.usage.cacheWriteTokens,
    llmOutputTokens: result.usage.outputTokens,
    costMicroUsd: result.costMicroUsd + ttsCostMicroUsd(t.reply.length) + avatarCostMicroUsd(avatarSeconds),
  });

  const achievements = await checkAchievements(user.id);
  if (levelUp) await track("level_up", user.id, { level: levelUp });

  return {
    teacher: t,
    messageId: teacherMsg.id,
    xpGained: xp,
    totalXp: updated.xp,
    streakDays,
    achievements,
    difficulty,
    levelUp,
    provider: result.provider,
    remainingTurns: Number.isFinite(lim.limit) ? Math.max(0, lim.limit - lim.used - 1) : null,
  };
}

async function rememberCorrections(userId: string, corrections: Correction[]) {
  for (const c of corrections) {
    const key = normalizePatternKey(c.patternKey);
    const existing = await db.mistakePattern.findUnique({ where: { userId_key: { userId, key } } });
    if (existing) {
      const next = onMistakeRepeated(existing);
      await db.mistakePattern.update({
        where: { id: existing.id },
        data: { count: next.count, ease: next.ease, intervalDays: next.intervalDays, dueAt: next.dueAt, example: c.youSaid, better: c.moreNatural || c.better, lastSeenAt: new Date(), mastered: false },
      });
    } else {
      await db.mistakePattern.create({
        data: { userId, key, category: c.category, label: c.patternLabel, example: c.youSaid, better: c.moreNatural || c.better },
      });
    }
  }
}

/** Provider cost estimates (USD per unit) so the admin dashboard reflects full AI COGS. */
function ttsCostMicroUsd(chars: number) {
  return process.env.TTS_PROVIDER === "elevenlabs" ? Math.round(chars * 180) /* ~$0.18 / 1k chars */ : 0;
}
function avatarCostMicroUsd(seconds: number) {
  return process.env.AVATAR_PROVIDER === "video" ? Math.round(seconds * 2500) /* ~$0.15 / min streaming avatar */ : 0;
}

export async function endSession(userId: string, sessionId: string) {
  const s = await db.learningSession.findFirst({ where: { id: sessionId, userId }, include: { messages: true } });
  if (!s) return null;
  const corrections = s.messages
    .filter((m) => m.role === "teacher" && m.corrections)
    .flatMap((m) => parseJson<{ corrections: Correction[] }>(m.corrections, { corrections: [] }).corrections);
  const bonus = s.endedAt || s.turns === 0 ? 0 : s.mode === "daily" && s.turns >= 5 ? XP_RULES.dailyChallenge : XP_RULES.sessionComplete;
  const summary = {
    ...parseJson<Record<string, unknown>>(s.summary, {}),
    turns: s.turns,
    words: s.wordsSpoken,
    speakingSeconds: s.speakingSeconds,
    topCorrections: corrections.slice(-3),
    bonusXp: bonus,
  };
  await db.learningSession.update({ where: { id: s.id }, data: { endedAt: s.endedAt ?? new Date(), summary: JSON.stringify(summary), xpEarned: { increment: bonus } } });
  if (bonus) await db.user.update({ where: { id: userId }, data: { xp: { increment: bonus } } });
  if (s.mode === "assessment") {
    await db.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
    await track("onboarding_complete", userId, { via: "assessment" });
  }
  await checkAchievements(userId);
  return summary;
}

export async function checkAchievements(userId: string) {
  const [user, sessionAgg, interviewSessions, roleplays, words, mastered, unlocked, skills] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.learningSession.aggregate({ where: { userId, turns: { gt: 0 } }, _count: true, _sum: { speakingSeconds: true } }),
    db.learningSession.count({ where: { userId, mode: "interview", turns: { gt: 2 } } }),
    db.learningSession.count({ where: { userId, mode: "roleplay", turns: { gt: 2 } } }),
    db.vocabularyItem.count({ where: { userId } }),
    db.mistakePattern.count({ where: { userId, mastered: true } }),
    db.userAchievement.findMany({ where: { userId } }),
    getSkills(userId),
  ]);
  const stats: AchievementStats = {
    sessions: sessionAgg._count,
    speakingMinutes: (sessionAgg._sum.speakingSeconds ?? 0) / 60,
    streakDays: user.streakDays,
    wordsLearned: words,
    interviewSessions,
    roleplays,
    confidence: skills.map.confidence,
    level: user.cefrLevel,
    masteredMistakes: mastered,
  };
  const have = new Set(unlocked.map((u) => u.achievement));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(stats));
  for (const a of fresh) await db.userAchievement.create({ data: { userId, achievement: a.id } });
  return fresh.map((a) => ({ id: a.id, title: a.title, icon: a.icon }));
}

export type { ModeId };
