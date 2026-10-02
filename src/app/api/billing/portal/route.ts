import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoBillingAllowed, getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { track } from "@/lib/analytics/track";
import { errorResponse, json } from "@/lib/http";

/** Manage/cancel subscription. Stripe's hosted portal in production; a direct cancel in demo mode. */
export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    if (stripeEnabled() && user.subscription?.stripeCustomerId) {
      const s = await getStripe().billingPortal.sessions.create({ customer: user.subscription.stripeCustomerId, return_url: `${appUrl}/profile` });
      return json({ url: s.url });
    }
    if (!demoBillingAllowed()) return json({ error: "Billing is not configured" }, 503);
    await db.subscription.update({ where: { userId: user.id }, data: { status: "canceled", canceledAt: new Date(), mrrCents: 0, currentPeriodEnd: new Date() } });
    await track("churned", user.id, { demo: true });
    return json({ url: `${appUrl}/profile?canceled=1` });
  } catch (e) {
    return errorResponse(e);
  }
}
