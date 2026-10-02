import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MODES } from "@/lib/config/modes";
import { CEFR_INFO, type Cefr } from "@/lib/config/cefr";
import { dailyTopic } from "@/lib/ai/prompt";
import { dayKey, levelFromXp } from "@/lib/learning/gamification";
import { selectFocus } from "@/lib/learning/memory";
import { effectivePlan, hasFeature } from "@/lib/billing/entitlements";
import { PLANS } from "@/lib/config/plans";
import { todayUsage } from "@/lib/billing/usage";
import { getSkills } from "@/lib/services/learning";
import { SKILL_LABELS, SKILLS } from "@/lib/learning/skills";

export const metadata = { title: "Home" };

export default async function Home({ searchParams }: { searchParams: Promise<{ upgraded?: string; welcome?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  if (!user.onboardedAt) redirect("/onboarding?step=language");
  const sp = await searchParams;
  const plan = effectivePlan(user.subscription);
  const [mistakes, usage, skills, lastSession] = await Promise.all([
    db.mistakePattern.findMany({ where: { userId: user.id, mastered: false }, take: 20 }),
    todayUsage(user.id),
    getSkills(user.id),
    db.learningSession.findFirst({ where: { userId: user.id, turns: { gt: 0 } }, orderBy: { startedAt: "desc" } }),
  ]);
  const focus = selectFocus(mistakes, new Date(), 1)[0];
  const lvl = levelFromXp(user.xp);
  const today = dayKey();
  const practisedToday = user.lastActiveDay === today;
  const weakest = [...SKILLS].sort((a, b) => skills.map[a] - skills.map[b])[0];
  const limits = PLANS[plan].limits;
  const convLeft = Number.isFinite(limits.conversationsPerDay) ? Math.max(0, limits.conversationsPerDay - usage.conversations) : null;
  const level = (user.cefrLevel as Cefr) in CEFR_INFO ? (user.cefrLevel as Cefr) : "A2";

  // Retention nudges: useful, specific, never spammy.
  const nudges: string[] = [];
  if (!practisedToday) nudges.push(user.streakDays > 0 ? `Keep your ${user.streakDays}-day streak alive — your 10-minute challenge is ready.` : "Your 10-minute speaking challenge is ready.");
  if (focus) nudges.push(`Let's fix a habit: “${focus.example}” → “${focus.better}”.`);
  nudges.push(`You are ${lvl.needed - lvl.current} XP away from level ${lvl.level + 1}.`);

  return (
    <div className="space-y-8">
      {sp.upgraded && <div className="rise rounded-2xl border border-good/40 bg-good/10 p-4">🎉 Welcome to {PLANS[sp.upgraded as keyof typeof PLANS]?.name ?? "Premium"}! Everything is unlocked — enjoy unlimited practice with Maya.</div>}
      {sp.welcome && <div className="rise rounded-2xl border border-accent/40 bg-accent/10 p-4">Thanks for chatting! Your English level is <b>{level}</b> — {CEFR_INFO[level].title.toLowerCase()}. Your plan below is personalised to it.</div>}

      <section className="grid items-center gap-6 rounded-3xl border border-line bg-[radial-gradient(120%_90%_at_80%_0%,#2a3b55_0%,#121a26_60%)] p-6 md:grid-cols-[1.4fr_1fr] md:p-10">
        <div>
          <p className="label">Good to see you{user.name ? `, ${user.name}` : ""}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">Today&apos;s topic: {dailyTopic(today)}</h1>
          <p className="mt-3 text-muted">Level {level} · {CEFR_INFO[level].title}. Focus: {CEFR_INFO[level].focus}.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/practice?mode=daily" className="btn btn-primary px-8 py-4 text-lg">🎙️ START SPEAKING</Link>
            <Link href="/practice?mode=free" className="btn btn-ghost">Free conversation</Link>
          </div>
          {convLeft !== null && <p className="mt-3 text-xs text-muted">{convLeft} free conversation{convLeft === 1 ? "" : "s"} left today · <Link href="/pricing" className="underline">Go unlimited</Link></p>}
        </div>
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Level {lvl.level}</span>
              <span className="text-muted">{lvl.current}/{lvl.needed} XP</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-panel-2" role="progressbar" aria-valuenow={Math.round(lvl.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-sm">🔥 {user.streakDays}-day streak {practisedToday ? "· done for today ✓" : ""}</p>
          </div>
          <ul className="space-y-2">
            {nudges.map((n) => (
              <li key={n} className="rounded-xl border border-line bg-panel/70 px-4 py-2.5 text-sm">{n}</li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-2xl">Practice</h2>
          <span className="text-sm text-muted">Recommended: {SKILL_LABELS[weakest]}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {MODES.filter((m) => m.id !== "assessment").map((m) => {
            const locked = !hasFeature(plan, m.requires);
            const href = m.id === "roleplay" ? "/roleplay" : m.id === "pronunciation" ? "/pronunciation" : `/practice?mode=${m.id}`;
            return (
              <Link key={m.id} href={locked ? `/pricing?from=${m.id}` : href} className="card group p-4 transition hover:border-brand/50">
                <div className="flex items-start justify-between">
                  <span className="text-2xl" aria-hidden>{m.icon}</span>
                  {locked && <span className="chip !py-0 !text-[10px]">PREMIUM</span>}
                </div>
                <h3 className="mt-3 font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted">{m.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {lastSession && (
        <p className="text-sm text-muted">
          Last session: {lastSession.turns} replies, +{lastSession.xpEarned} XP · <Link href="/progress" className="underline">see your progress</Link>
        </p>
      )}
    </div>
  );
}
