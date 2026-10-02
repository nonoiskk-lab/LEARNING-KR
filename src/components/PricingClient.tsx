"use client";

import { useEffect, useState } from "react";
import type { Plan } from "@/lib/config/plans";

export default function PricingClient({ plans, current, signedIn, trialDays, addOns }: { plans: Plan[]; current: string; signedIn: boolean; trialDays: number; addOns: { id: string; name: string; priceDisplay: string }[] }) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "pricing_viewed" }) }).catch(() => {});
  }, []);

  async function buy(plan: string) {
    if (!signedIn) {
      window.location.href = "/onboarding";
      return;
    }
    setBusy(plan);
    setError(null);
    const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, interval }) });
    const data = await res.json();
    setBusy(null);
    if (data.url) window.location.href = data.url;
    else setError(data.error ?? "Checkout failed");
  }

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-full border border-line p-1" role="radiogroup" aria-label="Billing period">
        {(["month", "year"] as const).map((i) => (
          <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`rounded-full px-5 py-2 text-sm ${interval === i ? "bg-brand text-ink" : "text-muted"}`}>
            {i === "month" ? "Monthly" : "Yearly · save 40%+"}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`card relative flex flex-col p-6 ${p.highlight ? "border-brand/70 shadow-[0_0_0_1px_var(--color-brand)]" : ""}`}>
            {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-ink">Most popular</span>}
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="text-sm text-muted">{p.tagline}</p>
            <p className="mt-4 text-3xl font-semibold">{p.priceDisplay[interval]}</p>
            {p.id !== "free" && interval === "year" && <p className="text-xs text-muted">≈ ${(p.mrrCents.year / 100).toFixed(2)}/month, billed yearly</p>}
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            {p.id === "free" ? (
              <a href={signedIn ? "/app" : "/onboarding"} className="btn btn-ghost mt-6">{current === "free" && signedIn ? "Current plan" : "Start free"}</a>
            ) : current === p.id ? (
              <span className="btn btn-ghost mt-6 opacity-70">Current plan</span>
            ) : (
              <button className={`btn mt-6 ${p.highlight ? "btn-primary" : "btn-ghost"}`} disabled={busy !== null} onClick={() => buy(p.id)}>
                {busy === p.id ? "Opening checkout…" : `Start ${trialDays}-day free trial`}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-4 text-center text-sm text-bad" role="alert">{error}</p>}
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-semibold">Add-ons</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {addOns.map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><span className="text-muted">{a.priceDisplay}</span></li>)}
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold">Teams, schools & colleges</h3>
          <p className="mt-2 text-sm text-muted">Seat-based plans with an admin view of learner progress, SSO and invoicing. B2B licensing available for training providers.</p>
          <a href="mailto:sales@fluentia.app" className="btn btn-ghost mt-4">Contact sales</a>
        </div>
      </div>
    </div>
  );
}
