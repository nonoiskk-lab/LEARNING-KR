import { PLANS, type Feature, type Limits, type PlanId } from "../config/plans";

export interface SubLike {
  plan: string;
  status: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}

/** The plan a user actually gets right now (lapsed or failed payments fall back to free). */
export function effectivePlan(sub: SubLike | null | undefined, now = new Date()): PlanId {
  if (!sub) return "free";
  const plan = (sub.plan in PLANS ? sub.plan : "free") as PlanId;
  if (plan === "free") return "free";
  if (sub.status === "active") return plan;
  if (sub.status === "trialing") return !sub.trialEndsAt || sub.trialEndsAt > now ? plan : "free";
  // past_due gets a grace period until the paid period ends
  if (sub.status === "past_due" || sub.status === "canceled") return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? plan : "free";
  return "free";
}

export function hasFeature(plan: PlanId, feature: Feature | undefined): boolean {
  if (!feature) return true;
  return PLANS[plan].entitlements.includes(feature);
}

export function minimumPlanFor(feature: Feature): PlanId {
  return (["premium", "pro"] as PlanId[]).find((p) => PLANS[p].entitlements.includes(feature)) ?? "pro";
}

export interface UsageLike {
  conversations: number;
  teacherTurns: number;
  avatarSeconds: number;
  roleplays: number;
  pronunciationDrills: number;
}

export type LimitKind = "conversation" | "turn" | "avatar" | "roleplay" | "pronunciation";

export function checkLimit(plan: PlanId, usage: UsageLike, kind: LimitKind): { ok: boolean; limit: number; used: number } {
  const l: Limits = PLANS[plan].limits;
  const map: Record<LimitKind, [number, number]> = {
    conversation: [usage.conversations, l.conversationsPerDay],
    turn: [usage.teacherTurns, l.teacherTurnsPerDay],
    avatar: [usage.avatarSeconds, l.avatarMinutesPerDay * 60],
    roleplay: [usage.roleplays, l.roleplaysPerDay],
    pronunciation: [usage.pronunciationDrills, l.pronunciationDrillsPerDay],
  };
  const [used, limit] = map[kind];
  return { ok: used < limit, limit, used };
}

/** Contextual, non-interruptive upgrade copy. Shown only at natural stopping points. */
export function upgradeMessage(kind: LimitKind | "feature", feature?: Feature): { title: string; body: string } {
  switch (kind) {
    case "conversation":
    case "turn":
      return { title: "You've completed today's free speaking sessions 🎉", body: "Great work today. Unlock unlimited AI conversations and keep practising with Maya — or come back tomorrow for more free practice." };
    case "avatar":
      return { title: "Today's free avatar minutes are used", body: "You can keep practising in voice-only mode, or upgrade for up to 60 avatar minutes a day." };
    case "roleplay":
      return { title: "Ready for another scene?", body: "Free includes one roleplay a day. Premium unlocks every scenario, unlimited." };
    case "pronunciation":
      return { title: "Nice pronunciation streak!", body: "Free includes 5 drills a day. Premium unlocks the full pronunciation lab with unlimited drills." };
    default:
      return {
        title: "This is a Premium experience",
        body: feature === "interview_practice" ? "Practise with a realistic AI interviewer and get coached on every answer." : feature === "business_english" ? "Meetings, updates, negotiations — practise the English that moves your career." : "Unlock premium scenarios, personalised plans and advanced feedback.",
      };
  }
}
