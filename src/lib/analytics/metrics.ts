/**
 * SaaS unit economics. Pure functions over plain data so they are testable
 * and can later run in a warehouse job instead of the app database.
 */
export interface SubRow {
  plan: string;
  status: string;
  mrrCents: number;
  createdAt: Date;
  canceledAt: Date | null;
}

export function mrrCents(subs: SubRow[]): number {
  return subs.filter((s) => s.plan !== "free" && (s.status === "active" || s.status === "past_due")).reduce((a, s) => a + s.mrrCents, 0);
}

export function paidCount(subs: SubRow[]): number {
  return subs.filter((s) => s.plan !== "free" && (s.status === "active" || s.status === "past_due" || s.status === "trialing")).length;
}

/** Monthly logo churn: paid subscriptions canceled in the window / paid at window start. */
export function monthlyChurn(subs: SubRow[], now = new Date()): number {
  const start = new Date(now.getTime() - 30 * 86_400_000);
  const paidAtStart = subs.filter((s) => s.plan !== "free" && s.createdAt <= start && (!s.canceledAt || s.canceledAt > start)).length;
  const churned = subs.filter((s) => s.plan !== "free" && s.canceledAt && s.canceledAt > start && s.canceledAt <= now).length;
  return paidAtStart ? churned / paidAtStart : 0;
}

export interface UnitEconomicsInput {
  mrrCents: number;
  totalUsers: number;
  paidUsers: number;
  monthlyChurn: number;
  aiCostCents30d: number;
  activeUsers30d: number;
  marketingSpendCents30d: number;
  newPaidUsers30d: number;
}

export interface UnitEconomics {
  mrr: number;
  arr: number;
  arpu: number; // per active user
  arppu: number; // per paying user
  conversionRate: number;
  ltv: number;
  cac: number | null;
  ltvToCac: number | null;
  aiCostPerUser: number;
  aiCostPerPaidUser: number;
  grossMargin: number;
}

export function unitEconomics(i: UnitEconomicsInput): UnitEconomics {
  const mrr = i.mrrCents / 100;
  const aiCost = i.aiCostCents30d / 100;
  const arppu = i.paidUsers ? mrr / i.paidUsers : 0;
  const grossMargin = mrr > 0 ? (mrr - aiCost) / mrr : 0;
  // LTV = ARPPU × gross margin / churn; cap lifetime at 36 months when churn is ~0
  const lifetimeMonths = i.monthlyChurn > 0 ? Math.min(36, 1 / i.monthlyChurn) : 36;
  const ltv = arppu * Math.max(0, grossMargin) * lifetimeMonths;
  // No spend recorded means CAC is unknown, not zero.
  const cac = i.newPaidUsers30d && i.marketingSpendCents30d > 0 ? i.marketingSpendCents30d / 100 / i.newPaidUsers30d : null;
  return {
    mrr,
    arr: mrr * 12,
    arpu: i.activeUsers30d ? mrr / i.activeUsers30d : 0,
    arppu,
    conversionRate: i.totalUsers ? i.paidUsers / i.totalUsers : 0,
    ltv,
    cac,
    ltvToCac: cac ? ltv / cac : null,
    aiCostPerUser: i.activeUsers30d ? aiCost / i.activeUsers30d : 0,
    aiCostPerPaidUser: i.paidUsers ? aiCost / i.paidUsers : 0,
    grossMargin,
  };
}

/** Classic N-day retention: share of a signup cohort active on day N (±0). */
export function retention(cohort: { signupDay: string; activeDays: Set<string> }[], n: number): number {
  const eligible = cohort.filter((u) => Date.now() - Date.parse(u.signupDay) >= n * 86_400_000);
  if (!eligible.length) return 0;
  const kept = eligible.filter((u) => {
    const target = new Date(Date.parse(u.signupDay) + n * 86_400_000).toISOString().slice(0, 10);
    return u.activeDays.has(target);
  }).length;
  return kept / eligible.length;
}
