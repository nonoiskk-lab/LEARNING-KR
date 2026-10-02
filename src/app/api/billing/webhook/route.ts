import type Stripe from "stripe";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/config/plans";
import { getStripe, planForPrice } from "@/lib/billing/stripe";
import { track } from "@/lib/analytics/track";

/** Stripe is the source of truth for subscription state; this mirrors it locally. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("not configured", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), sig ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;
      const item = sub.items.data[0];
      const mapped = item ? planForPrice(item.price.id) : null;
      const deleted = event.type === "customer.subscription.deleted";
      const status = deleted ? "canceled" : sub.status === "trialing" ? "trialing" : sub.status === "active" ? "active" : sub.status === "past_due" || sub.status === "unpaid" ? "past_due" : "canceled";
      const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
      const prev = await db.subscription.findUnique({ where: { userId } });
      await db.subscription.upsert({
        where: { userId },
        create: { userId, plan: mapped?.plan ?? "premium", interval: mapped?.interval, status, stripeCustomerId: String(sub.customer), stripeSubscriptionId: sub.id, mrrCents: mapped && status === "active" ? PLANS[mapped.plan].mrrCents[mapped.interval] : 0, trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null, currentPeriodEnd: periodEnd },
        update: {
          plan: deleted ? "free" : (mapped?.plan ?? undefined),
          interval: mapped?.interval,
          status,
          stripeSubscriptionId: sub.id,
          mrrCents: mapped && (status === "active" || status === "past_due") ? PLANS[mapped.plan].mrrCents[mapped.interval] : 0,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: periodEnd,
          canceledAt: deleted || sub.cancel_at_period_end ? new Date() : null,
        },
      });
      if (status === "active" && prev?.status !== "active") await track("subscribed", userId, { plan: mapped?.plan, interval: mapped?.interval });
      if (deleted) await track("churned", userId, { plan: prev?.plan });
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const sub = await db.subscription.findFirst({ where: { stripeCustomerId: String(inv.customer) } });
      if (sub) await track("payment_failed", sub.userId, {});
      break;
    }
  }
  return new Response("ok");
}
