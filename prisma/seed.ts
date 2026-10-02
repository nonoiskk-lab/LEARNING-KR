/**
 * Demo data for the admin dashboard: ~120 learners over 60 days with realistic
 * activity, a free→paid funnel, churn, AI costs and marketing spend.
 * Run with: npm run db:seed   (never against production)
 */
import { PrismaClient } from "@prisma/client";
import { PLANS } from "../src/lib/config/plans";
import { SCENARIOS } from "../src/lib/config/scenarios";
import { hashPassword } from "./seed-hash";

const db = new PrismaClient();
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const MISTAKES = [
  ["for_vs_since", "for vs since", "grammar"],
  ["third_person_s", "he/she/it + verb-s", "grammar"],
  ["missing_article", "a/an before jobs", "grammar"],
  ["did_plus_base_verb", "didn't + base verb", "grammar"],
  ["v_w_confusion", "V vs W sounds", "pronunciation"],
  ["discuss_about", "discuss (no 'about')", "word_choice"],
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed production");
  const langs = ["hi", "hi", "hi", "bn", "ta", "te", "mr", "es", "ar", "pt", "ja", "ko", "ur"];
  const now = Date.now();
  for (let i = 0; i < 120; i++) {
    const created = new Date(now - rand(0, 60) * DAY);
    const engaged = Math.random();
    const paid = engaged > 0.78 ? (Math.random() > 0.8 ? "pro" : "premium") : "free";
    const interval = Math.random() > 0.5 ? "year" : "month";
    const churned = paid !== "free" && Math.random() < 0.12;
    const user = await db.user.create({
      data: {
        email: `learner${i}@demo.fluentia`,
        isGuest: Math.random() < 0.35,
        nativeLanguage: pick(langs),
        cefrLevel: pick(["A1", "A2", "A2", "B1", "B1", "B2", "C1"]),
        onboardedAt: created,
        createdAt: created,
        xp: Math.round(engaged * 2400),
        streakDays: Math.round(engaged * 14),
        acquisitionSource: pick(["google", "instagram", "youtube", "referral", null]),
        subscription: {
          create: {
            plan: churned ? "free" : paid,
            interval: paid === "free" ? null : interval,
            status: churned ? "canceled" : "active",
            mrrCents: paid === "free" || churned ? 0 : PLANS[paid].mrrCents[interval],
            createdAt: new Date(created.getTime() + rand(1, 5) * DAY),
            canceledAt: churned ? new Date(now - rand(0, 25) * DAY) : null,
          },
        },
      },
    });
    await db.analyticsEvent.createMany({
      data: [
        { userId: user.id, name: "signup", createdAt: created },
        { userId: user.id, name: "onboarding_complete", createdAt: created },
        ...(engaged > 0.3 ? [{ userId: user.id, name: "session_start", createdAt: created }] : []),
        ...(engaged > 0.55 ? [{ userId: user.id, name: "upgrade_prompt_shown", createdAt: created }] : []),
        ...(engaged > 0.7 ? [{ userId: user.id, name: "checkout_started", createdAt: created }] : []),
        ...(paid !== "free" ? [{ userId: user.id, name: "subscribed", createdAt: created }] : []),
      ],
    });
    const activeDays = Math.round(engaged * engaged * 40);
    for (let d = 0; d < activeDays; d++) {
      const day = new Date(Math.min(now, created.getTime() + d * DAY * rand(0.8, 1.6)));
      const turns = Math.round(rand(4, 30));
      const inTok = turns * 2600;
      const outTok = turns * 420;
      await db.usageDay.upsert({
        where: { userId_day: { userId: user.id, day: iso(day) } },
        create: {
          userId: user.id, day: iso(day), conversations: Math.ceil(turns / 10), teacherTurns: turns, speakingSeconds: turns * 9, sttSeconds: turns * 9,
          avatarSeconds: turns * 11, ttsChars: turns * 180, llmInputTokens: inTok, llmOutputTokens: outTok, roleplays: Math.random() > 0.6 ? 1 : 0,
          costMicroUsd: Math.round(inTok * 0.6 + outTok * 20), // mostly cache reads
        },
        update: {},
      });
      if (d % 3 === 0) {
        const sc = Math.random() > 0.6 ? pick(SCENARIOS) : null;
        await db.learningSession.create({
          data: { userId: user.id, mode: sc ? "roleplay" : pick(["free", "daily", "daily", "travel", "business", "interview"]), scenarioId: sc?.id, startedAt: day, endedAt: new Date(day.getTime() + rand(4, 16) * 60000), turns, wordsSpoken: turns * 11, speakingSeconds: turns * 9, xpEarned: turns * 10 },
        });
      }
    }
    for (const [key, label, category] of MISTAKES) {
      if (Math.random() < 0.4) await db.mistakePattern.create({ data: { userId: user.id, key, label, category, example: "…", better: "…", count: Math.ceil(rand(1, 6)) } });
    }
  }
  const month = iso(new Date()).slice(0, 7);
  await db.marketingSpend.createMany({ data: [{ month, channel: "google", cents: 42_000 }, { month, channel: "instagram", cents: 31_000 }] });
  await db.user.upsert({
    where: { email: "admin@example.com" },
    create: { email: "admin@example.com", passwordHash: await hashPassword("supersecret1"), isGuest: false, role: "admin", onboardedAt: new Date(), subscription: { create: { plan: "free" } } },
    update: { role: "admin" },
  });
  console.log("Seeded demo data. Admin login: admin@example.com / supersecret1");
}

main().finally(() => db.$disconnect());
