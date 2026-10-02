import { Suspense } from "react";
import OnboardingClient from "@/components/OnboardingClient";
import { LANGUAGES, SELF_LEVELS } from "@/lib/config/languages";

export const metadata = { title: "Welcome" };

export default function Onboarding() {
  return (
    <Suspense>
      <OnboardingClient languages={LANGUAGES} levels={SELF_LEVELS.map((l) => ({ id: l.id, label: l.label, hint: l.hint }))} />
    </Suspense>
  );
}
