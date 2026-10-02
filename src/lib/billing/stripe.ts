import "server-only";
import Stripe from "stripe";
import { PLANS, type Interval, type PlanId } from "../config/plans";

let stripe: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Fake upgrades without Stripe: always in dev, opt-in elsewhere. Never enable on a public production deploy. */
export function demoBillingAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.BILLING_DEMO_MODE === "true";
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export function priceIdFor(plan: PlanId, interval: Interval): string | null {
  const env = PLANS[plan].stripePriceEnv[interval];
  return env ? process.env[env] || null : null;
}

/** Reverse lookup used by the webhook to map a Stripe price back to a plan. */
export function planForPrice(priceId: string): { plan: PlanId; interval: Interval } | null {
  for (const plan of ["premium", "pro"] as PlanId[])
    for (const interval of ["month", "year"] as Interval[]) if (priceIdFor(plan, interval) === priceId) return { plan, interval };
  return null;
}
