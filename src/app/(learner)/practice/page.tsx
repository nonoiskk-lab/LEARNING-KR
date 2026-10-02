import Link from "next/link";
import { redirect } from "next/navigation";
import SessionClient from "@/components/SessionClient";
import { currentUser } from "@/lib/auth";
import { MODES, SCENES, getMode } from "@/lib/config/modes";
import { getScenario } from "@/lib/config/scenarios";
import { effectivePlan, hasFeature } from "@/lib/billing/entitlements";
import { teacherProvider } from "@/lib/ai/teacher";

export const metadata = { title: "Practice" };

export default async function Practice({ searchParams }: { searchParams: Promise<{ mode?: string; scenario?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const sp = await searchParams;
  const plan = effectivePlan(user.subscription);

  if (!sp.mode && !sp.scenario) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl">Practice</h1>
          <p className="mt-1 text-muted">Pick how you want to practise today. Every mode adapts to your level.</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.filter((m) => m.id !== "assessment").map((m) => {
            const locked = !hasFeature(plan, m.requires);
            const href = m.id === "roleplay" ? "/roleplay" : m.id === "pronunciation" ? "/pronunciation" : `/practice?mode=${m.id}`;
            return (
              <Link key={m.id} href={locked ? `/pricing?from=${m.id}` : href} className="card flex items-center gap-4 p-5 transition hover:border-brand/50">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: SCENES[m.scene].background }} aria-hidden>{m.icon}</span>
                <span>
                  <span className="font-semibold">{m.title}</span>
                  {locked && <span className="chip ml-2 !py-0 !text-[10px]">PREMIUM</span>}
                  <span className="mt-0.5 block text-sm text-muted">{m.blurb}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const scenario = getScenario(sp.scenario);
  const mode = getMode(scenario ? "roleplay" : sp.mode ?? "free");
  const scene = SCENES[scenario?.scene ?? mode.scene];
  return (
    <SessionClient
      mode={mode.id}
      scenarioId={scenario?.id}
      title={scenario ? scenario.title : mode.title}
      subtitle={scenario ? `${scenario.goal}` : mode.blurb}
      sceneBackground={scene.background}
      sceneName={scene.name}
      prefs={{ nativeLanguage: user.nativeLanguage, voiceSpeed: user.voiceSpeed, voiceStyle: user.voiceStyle, voiceConsent: Boolean(user.voiceConsentAt) }}
      aiMode={teacherProvider()}
    />
  );
}
