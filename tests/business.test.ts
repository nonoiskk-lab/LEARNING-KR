import { describe, expect, it } from "vitest";
import { checkLimit, effectivePlan, hasFeature, minimumPlanFor } from "@/lib/billing/entitlements";
import { monthlyChurn, mrrCents, unitEconomics, retention } from "@/lib/analytics/metrics";
import { costMicroUsd } from "@/lib/ai/teacher";

const usage = { conversations: 0, teacherTurns: 0, avatarSeconds: 0, roleplays: 0, pronunciationDrills: 0 };

describe("entitlements", () => {
  it("free plan has daily limits, premium is unlimited conversations", () => {
    expect(checkLimit("free", { ...usage, conversations: 1 }, "conversation").ok).toBe(true);
    expect(checkLimit("free", { ...usage, conversations: 2 }, "conversation").ok).toBe(false);
    expect(checkLimit("premium", { ...usage, conversations: 999 }, "conversation").ok).toBe(true);
  });
  it("gates premium features", () => {
    expect(hasFeature("free", "interview_practice")).toBe(false);
    expect(hasFeature("premium", "interview_practice")).toBe(true);
    expect(hasFeature("premium", "presentation_training")).toBe(false);
    expect(minimumPlanFor("presentation_training")).toBe("pro");
    expect(hasFeature("free", undefined)).toBe(true);
  });
  it("falls back to free when a trial or grace period ends", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 86_400_000);
    expect(effectivePlan({ plan: "premium", status: "active" })).toBe("premium");
    expect(effectivePlan({ plan: "premium", status: "trialing", trialEndsAt: past })).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "past_due", currentPeriodEnd: future })).toBe("pro");
    expect(effectivePlan({ plan: "pro", status: "canceled", currentPeriodEnd: past })).toBe("free");
    expect(effectivePlan(null)).toBe("free");
  });
});

describe("unit economics", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const old = new Date("2026-01-01T00:00:00Z");
  const subs = [
    { plan: "premium", status: "active", mrrCents: 1299, createdAt: old, canceledAt: null },
    { plan: "pro", status: "active", mrrCents: 1500, createdAt: old, canceledAt: null },
    { plan: "premium", status: "canceled", mrrCents: 0, createdAt: old, canceledAt: new Date("2026-06-20T00:00:00Z") },
    { plan: "free", status: "active", mrrCents: 0, createdAt: old, canceledAt: null },
  ];
  it("computes MRR and churn", () => {
    expect(mrrCents(subs)).toBe(2799);
    expect(monthlyChurn(subs, now)).toBeCloseTo(1 / 3);
  });
  it("computes LTV, CAC, margin", () => {
    const e = unitEconomics({ mrrCents: 10_000, totalUsers: 100, paidUsers: 10, monthlyChurn: 0.05, aiCostCents30d: 2_000, activeUsers30d: 50, marketingSpendCents30d: 20_000, newPaidUsers30d: 5 });
    expect(e.arr).toBe(1200);
    expect(e.conversionRate).toBe(0.1);
    expect(e.grossMargin).toBeCloseTo(0.8);
    expect(e.ltv).toBeCloseTo(10 * 0.8 * 20);
    expect(e.cac).toBe(40);
    expect(e.ltvToCac).toBeCloseTo(4);
  });
  it("reports CAC as unknown when no marketing spend is recorded", () => {
    const e = unitEconomics({ mrrCents: 1000, totalUsers: 10, paidUsers: 1, monthlyChurn: 0, aiCostCents30d: 0, activeUsers30d: 5, marketingSpendCents30d: 0, newPaidUsers30d: 1 });
    expect(e.cac).toBeNull();
    expect(e.ltvToCac).toBeNull();
  });
  it("computes N-day retention", () => {
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    const cohort = [
      { signupDay: day(10), activeDays: new Set([day(9)]) },
      { signupDay: day(10), activeDays: new Set<string>() },
    ];
    expect(retention(cohort, 1)).toBe(0.5);
  });
  it("prices LLM usage per model", () => {
    // 1M input + 1M output on Opus 5.5 = $4 + $20 = $24 = 24e6 micro-USD
    expect(costMicroUsd("claude-opus-5-5", { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(24e6);
  });
});
