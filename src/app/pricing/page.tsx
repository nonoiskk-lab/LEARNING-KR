import Link from "next/link";
import PricingClient from "@/components/PricingClient";
import { currentUser } from "@/lib/auth";
import { ADD_ONS, PLANS, TRIAL_DAYS } from "@/lib/config/plans";
import { effectivePlan } from "@/lib/billing/entitlements";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function Pricing() {
  const user = await currentUser();
  // Infinity limits can't cross the server/client boundary; JSON turns them into null (the client only shows copy).
  const plans = JSON.parse(JSON.stringify(Object.values(PLANS)));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-10 flex items-center justify-between">
        <Link href={user ? "/app" : "/"} className="font-display text-2xl font-semibold">Fluentia<span className="text-brand">.</span></Link>
        {user && <Link href="/app" className="text-sm text-muted">← Back to practice</Link>}
      </header>
      <h1 className="text-center font-display text-4xl md:text-5xl">Practise every day with your teacher</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">Real learning value on the free plan, forever. Upgrade for unlimited conversations, premium scenarios and a personal plan.</p>
      <div className="mt-10">
        <PricingClient plans={plans} current={effectivePlan(user?.subscription)} signedIn={Boolean(user)} trialDays={TRIAL_DAYS} addOns={ADD_ONS} />
      </div>
    </div>
  );
}
