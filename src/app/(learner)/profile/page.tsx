import { redirect } from "next/navigation";
import ProfileClient from "@/components/ProfileClient";
import { currentUser, isAdmin } from "@/lib/auth";
import { LANGUAGES } from "@/lib/config/languages";
import { PLANS } from "@/lib/config/plans";
import { effectivePlan } from "@/lib/billing/entitlements";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  const plan = effectivePlan(user.subscription);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Profile</h1>
      <ProfileClient
        user={{ name: user.name ?? "", email: user.email, isGuest: user.isGuest, nativeLanguage: user.nativeLanguage, voiceSpeed: user.voiceSpeed, voiceStyle: user.voiceStyle, textSize: user.textSize, voiceConsent: Boolean(user.voiceConsentAt), cefr: user.cefrLevel }}
        plan={{ id: plan, name: PLANS[plan].name, status: user.subscription?.status ?? "active", renews: plan !== "free" && user.subscription?.currentPeriodEnd ? user.subscription.currentPeriodEnd.toLocaleDateString() : null }}
        languages={LANGUAGES.map((l) => ({ code: l.code, name: l.name, native: l.native }))}
        isAdmin={isAdmin(user)}
      />
    </div>
  );
}
