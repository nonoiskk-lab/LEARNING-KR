import { redirect } from "next/navigation";
import PronunciationLab from "@/components/PronunciationLab";
import { currentUser } from "@/lib/auth";
import { DRILLS, PRONUNCIATION_UNITS } from "@/lib/config/pronunciation";
import { effectivePlan, hasFeature } from "@/lib/billing/entitlements";

export const metadata = { title: "Pronunciation Lab" };

export default async function Pronunciation() {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const advanced = hasFeature(effectivePlan(user.subscription), "advanced_pronunciation");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Pronunciation Lab</h1>
        <p className="mt-1 text-muted">Listen → Repeat → Analyse → Feedback. Words turn green when Maya hears them clearly.</p>
      </header>
      <PronunciationLab units={PRONUNCIATION_UNITS} drills={DRILLS.map((d) => ({ ...d, locked: Boolean(d.premium && !advanced) }))} nativeLanguage={user.nativeLanguage} voiceSpeed={user.voiceSpeed} />
    </div>
  );
}
