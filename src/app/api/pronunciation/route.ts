import { currentUser, getOrCreateGuest } from "@/lib/auth";
import { db } from "@/lib/db";
import { DRILLS } from "@/lib/config/pronunciation";
import { scorePronunciation } from "@/lib/learning/pronunciation";
import { updateSkill } from "@/lib/learning/skills";
import { XP_RULES } from "@/lib/learning/gamification";
import { checkLimit, effectivePlan, hasFeature, upgradeMessage } from "@/lib/billing/entitlements";
import { addUsage, todayUsage } from "@/lib/billing/usage";
import { body, errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const user = (await currentUser()) ?? (await getOrCreateGuest());
    const b = await body<{ drillId?: string; heard?: string; confidence?: number; seconds?: number }>(req);
    const drill = DRILLS.find((d) => d.id === b.drillId);
    if (!drill) return json({ error: "Unknown drill" }, 404);
    const plan = effectivePlan(user.subscription);
    if (drill.premium && !hasFeature(plan, "advanced_pronunciation")) return json({ error: "limit", kind: "feature", upgrade: upgradeMessage("feature", "advanced_pronunciation") }, 402);
    const usage = await todayUsage(user.id);
    if (!checkLimit(plan, usage, "pronunciation").ok) return json({ error: "limit", kind: "pronunciation", upgrade: upgradeMessage("pronunciation") }, 402);

    const result = scorePronunciation(drill.text, String(b.heard ?? ""), { nativeLanguage: user.nativeLanguage, sttConfidence: b.confidence });
    const row = await db.skillScore.findUnique({ where: { userId_skill: { userId: user.id, skill: "pronunciation" } } });
    const next = updateSkill(row?.score ?? 40, result.score, row?.samples ?? 0);
    await db.skillScore.upsert({
      where: { userId_skill: { userId: user.id, skill: "pronunciation" } },
      create: { userId: user.id, skill: "pronunciation", score: next, samples: 1 },
      update: { score: next, samples: { increment: 1 } },
    });
    const xp = result.score >= 70 ? XP_RULES.pronunciationPass : 2;
    await db.user.update({ where: { id: user.id }, data: { xp: { increment: xp } } });
    await addUsage(user.id, { pronunciationDrills: 1, sttSeconds: b.seconds ?? 4, speakingSeconds: b.seconds ?? 4 });
    return json({ ...result, xp, pronunciationSkill: next });
  } catch (e) {
    return errorResponse(e);
  }
}
