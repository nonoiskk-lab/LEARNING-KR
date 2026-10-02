import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SCENARIOS } from "@/lib/config/scenarios";
import { SCENES } from "@/lib/config/modes";
import { cefrIndex } from "@/lib/config/cefr";
import { effectivePlan, hasFeature } from "@/lib/billing/entitlements";

export const metadata = { title: "Roleplay" };

const CATEGORIES = ["Daily life", "Travel", "Work", "Business", "Career"] as const;

export default async function Roleplay() {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const plan = effectivePlan(user.subscription);
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Roleplay</h1>
        <p className="mt-1 text-muted">Step into a real situation. Maya plays the other person — the scene changes with the lesson.</p>
      </header>
      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2 className="mb-3 text-lg font-semibold">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCENARIOS.filter((s) => s.category === cat).map((s) => {
              const locked = !hasFeature(plan, s.requires);
              const stretch = cefrIndex(s.minLevel) > cefrIndex(user.cefrLevel) + 1;
              return (
                <Link key={s.id} href={locked ? `/pricing?from=roleplay_${s.id}` : `/practice?scenario=${s.id}`} className="group overflow-hidden rounded-2xl border border-line transition hover:border-brand/50">
                  <div className="flex h-24 items-end p-3" style={{ background: SCENES[s.scene].background }}>
                    <span className="chip bg-ink/60 !text-[11px] backdrop-blur">📍 {SCENES[s.scene].name}</span>
                    {locked && <span className="chip ml-auto bg-ink/60 !text-[10px]">PREMIUM</span>}
                  </div>
                  <div className="bg-panel p-4">
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.goal}</p>
                    <p className="mt-2 text-xs text-muted">From {s.minLevel}{stretch ? " · a stretch for you" : ""}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
