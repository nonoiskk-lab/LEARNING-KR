import { clearSession, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGES } from "@/lib/config/languages";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { body, errorResponse, json } from "@/lib/http";

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  const b = await body<{ name?: string; nativeLanguage?: string; voiceSpeed?: number; voiceStyle?: string; textSize?: string; voiceConsent?: boolean }>(req);
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string") data.name = b.name.slice(0, 60);
  if (b.nativeLanguage && LANGUAGES.some((l) => l.code === b.nativeLanguage)) data.nativeLanguage = b.nativeLanguage;
  if (typeof b.voiceSpeed === "number" && [0.75, 1, 1.25, 1.5].includes(b.voiceSpeed)) data.voiceSpeed = b.voiceSpeed;
  if (b.voiceStyle && ["warm", "clear", "energetic"].includes(b.voiceStyle)) data.voiceStyle = b.voiceStyle;
  if (b.textSize && ["sm", "md", "lg", "xl"].includes(b.textSize)) data.textSize = b.textSize;
  if (typeof b.voiceConsent === "boolean") data.voiceConsentAt = b.voiceConsent ? new Date() : null;
  await db.user.update({ where: { id: user.id }, data });
  return json({ ok: true });
}

/** Right to erasure: deletes the account and every learning record (cascades), cancels billing. */
export async function DELETE() {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    if (stripeEnabled() && user.subscription?.stripeSubscriptionId) {
      await getStripe().subscriptions.cancel(user.subscription.stripeSubscriptionId).catch(() => undefined);
    }
    await db.analyticsEvent.create({ data: { name: "account_deleted", props: JSON.stringify({ plan: user.subscription?.plan }) } });
    await db.user.delete({ where: { id: user.id } });
    await clearSession();
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
