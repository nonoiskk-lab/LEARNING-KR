import Link from "next/link";
import { redirect } from "next/navigation";
import BarChart from "@/components/BarChart";
import { currentUser } from "@/lib/auth";
import { progressSnapshot } from "@/lib/services/progress";
import { SKILL_LABELS, type Skill } from "@/lib/learning/skills";
import { effectivePlan, hasFeature } from "@/lib/billing/entitlements";
import { getMode } from "@/lib/config/modes";
import { getScenario } from "@/lib/config/scenarios";

export const metadata = { title: "Progress" };

const SHOWN: Skill[] = ["speaking", "grammar", "vocabulary", "pronunciation", "fluency", "confidence"];

export default async function Progress() {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const p = await progressSnapshot(user.id);
  const advanced = hasFeature(effectivePlan(user.subscription), "advanced_analytics");
  const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en", { weekday: "short" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Your progress</h1>
          <p className="mt-1 text-muted">Level {p.level} · {p.levelInfo.title}</p>
        </div>
        {p.user.isGuest && <Link href="/signup" className="btn btn-ghost text-sm">Save your progress — create an account</Link>}
      </header>

      <section className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Skills</h2>
            <span className="text-sm text-muted">Overall {Math.round(p.overall)}/100</span>
          </div>
          <ul className="mt-4 space-y-3">
            {SHOWN.map((s) => (
              <li key={s}>
                <div className="flex justify-between text-sm">
                  <span>{SKILL_LABELS[s]}</span>
                  <span className="tabular-nums text-muted">{Math.round(p.skills[s])}/100</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-panel-2" role="meter" aria-label={SKILL_LABELS[s]} aria-valuenow={Math.round(p.skills[s])} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${p.skills[s]}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4">
          <div className="card p-6">
            <p className="label">Current level</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-5xl">{p.level}</span>
              {p.nextLevel && <span className="text-muted">→ next: {p.nextLevel}</span>}
            </div>
            <div className="mt-3 h-2 rounded-full bg-panel-2" role="progressbar" aria-label="Progress to next level" aria-valuenow={Math.round(p.nextLevelProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round(p.nextLevelProgress * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Focus: {p.levelInfo.focus}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            <Tile n={p.speakingMinutes} label="speaking min" />
            <Tile n={p.wordsSpoken} label="words spoken" />
            <Tile n={p.lessonsCompleted} label="lessons" />
            <Tile n={p.user.streakDays} label="day streak 🔥" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-6 font-semibold">Speaking minutes · last 7 days</h2>
          <BarChart data={p.weekly.map((w) => ({ x: weekday(w.day), y: w.minutes }))} unit="min" label="Speaking minutes per day, last 7 days" />
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Common mistakes</h2>
            {!advanced && <Link href="/pricing?from=mistake_memory" className="text-xs text-brand">Unlock mistake memory →</Link>}
          </div>
          {p.mistakes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No recurring mistakes yet. Keep talking — Maya is learning how you speak.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {p.mistakes.map((m) => (
                <li key={m.key} className="flex items-start gap-3">
                  <span className={`chip !py-0 !text-xs ${m.mastered ? "!text-good" : ""}`}>{m.mastered ? "✓ fixed" : `×${m.count}`}</span>
                  <span>
                    <b>{m.label}</b>
                    <span className="block text-muted"><s>{m.example}</s> → <span className="text-good">{m.better}</span></span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Achievements</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {p.achievements.map((a) => (
            <li key={a.id} className={`rounded-2xl border p-3 text-center ${a.unlocked ? "border-brand/40 bg-brand/5" : "border-line opacity-45"}`} title={a.description}>
              <div className="text-2xl" aria-hidden>{a.icon}</div>
              <div className="mt-1 text-xs font-semibold">{a.title}</div>
              <div className="sr-only">{a.unlocked ? "unlocked" : "locked"}: {a.description}</div>
            </li>
          ))}
        </ul>
      </section>

      {p.recent.length > 0 && (
        <section className="card p-6">
          <h2 className="font-semibold">Recent sessions</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {p.recent.map((s) => (
              <li key={s.id} className="flex justify-between py-2.5">
                <span>{s.scenarioId ? getScenario(s.scenarioId)?.title : getMode(s.mode).title}</span>
                <span className="text-muted">{s.turns} replies · +{s.xp} XP · {new Date(s.startedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ n, label }: { n: number; label: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-semibold tabular-nums">{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
