import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, TRIAL_DAYS, type Interval, type PlanId } from "@/lib/config/plans";
import { demoBillingAllowed, getStripe, priceIdFor, stripeEnabled } from "@/lib/billing/stripe";
import { track } from "@/lib/analytics/track";
import { body, errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const b = await body<{ plan?: PlanId; interval?: Interval }>(req);
    const plan = b.plan === "pro" ? "pro" : "premium";
    const interval: Interval = b.interval === "year" ? "year" : "month";
    await track("checkout_started", user.id, { plan, interval });
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const firstTrial = !(await db.analyticsEvent.findFirst({ where: { userId: user.id, name: "subscribed" } }));

    if (!stripeEnabled()) {
      // Demo mode lets the full flow be exercised without Stripe (dev, or BILLING_DEMO_MODE=true on staging).
      if (!demoBillingAllowed()) return json({ error: "Billing is not configured" }, 503);
      const now = new Date();
      await db.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, plan, interval, status: "active", mrrCents: PLANS[plan].mrrCents[interval], currentPeriodEnd: new Date(now.getTime() + (interval === "year" ? 365 : 30) * 86_400_000) },
        update: { plan, interval, status: "active", canceledAt: null, mrrCents: PLANS[plan].mrrCents[interval], currentPeriodEnd: new Date(now.getTime() + (interval === "year" ? 365 : 30) * 86_400_000) },
      });
      await track("subscribed", user.id, { plan, interval, demo: true });
      return json({ url: `${appUrl}/app?upgraded=${plan}` });
    }

    const price = priceIdFor(plan, interval);
    if (!price) return json({ error: `Price for ${plan}/${interval} is not configured` }, 500);
    const stripe = getStripe();
    let customer = user.subscription?.stripeCustomerId ?? undefined;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } });
      customer = c.id;
      await db.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, stripeCustomerId: customer }, update: { stripeCustomerId: customer } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId: user.id }, ...(firstTrial ? { trial_period_days: TRIAL_DAYS } : {}) },
      success_url: `${appUrl}/app?upgraded=${plan}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
    });
    return json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}
