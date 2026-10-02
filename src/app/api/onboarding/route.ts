import { getOrCreateGuest } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGES, SELF_LEVELS } from "@/lib/config/languages";
import { body, errorResponse, json } from "@/lib/http";
import { track } from "@/lib/analytics/track";

/** Creates (or updates) a guest learner from the onboarding answers. */
export async function POST(req: Request) {
  try {
    const b = await body<{ nativeLanguage?: string; level?: string; name?: string; voiceConsent?: boolean; source?: string }>(req);
    const user = await getOrCreateGuest(b.source);
    const lang = LANGUAGES.find((l) => l.code === b.nativeLanguage)?.code;
    const level = SELF_LEVELS.find((l) => l.id === b.level);
    const data: Record<string, unknown> = {};
    if (lang) data.nativeLanguage = lang;
    if (b.name) data.name = String(b.name).slice(0, 60);
    if (b.voiceConsent) data.voiceConsentAt = new Date();
    if (level) {
      data.selfReportedLevel = level.id;
      if (level.cefr) {
        data.cefrLevel = level.cefr;
        data.onboardedAt = new Date();
      }
    }
    const updated = await db.user.update({ where: { id: user.id }, data });
    if (level?.cefr) await track("onboarding_complete", user.id, { via: "self_report", level: level.cefr });
    return json({ ok: true, needsAssessment: level?.id === "unsure", cefr: updated.cefrLevel });
  } catch (e) {
    return errorResponse(e);
  }
}
