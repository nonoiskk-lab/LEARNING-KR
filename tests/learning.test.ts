import { describe, expect, it } from "vitest";
import { nextDifficulty, observationsFromTurn, overallScore, updateSkill, wpmScore, defaultSkills } from "@/lib/learning/skills";
import { normalizePatternKey, onMistakeRepeated, onUsedCorrectly, selectFocus } from "@/lib/learning/memory";
import { levelFromXp, nextStreak, xpForLevel } from "@/lib/learning/gamification";
import { alignWords, scorePronunciation, tokenize } from "@/lib/learning/pronunciation";
import { cefrFromScore, nextCefr } from "@/lib/config/cefr";

describe("skills", () => {
  it("moves fast early and slowly later", () => {
    const early = updateSkill(40, 80, 0) - 40;
    const late = updateSkill(40, 80, 100) - 40;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });
  it("clamps to 0-100", () => {
    expect(updateSkill(99, 500, 0)).toBeLessThanOrEqual(100);
    expect(updateSkill(1, -50, 0)).toBeGreaterThanOrEqual(0);
  });
  it("adapts difficulty from recent turn scores", () => {
    expect(nextDifficulty([80, 82, 90])).toBe("harder");
    expect(nextDifficulty([60, 30, 40])).toBe("easier");
    expect(nextDifficulty([60, 70])).toBe("same");
  });
  it("derives listening and pronunciation only when signalled", () => {
    const o = observationsFromTurn({ grammar: 70, vocabulary: 60, fluency: 50, structure: 60, confidence: 50, complexity: 40 });
    expect(o.pronunciation).toBeUndefined();
    expect(o.listening).toBeUndefined();
    const s = observationsFromTurn({ grammar: 70, vocabulary: 60, fluency: 50, structure: 60, confidence: 50, complexity: 40, pronunciation: 80, understoodTeacher: false });
    expect(s.pronunciation).toBe(80);
    expect(s.listening).toBe(35);
  });
  it("rewards natural speaking rate", () => {
    expect(wpmScore(140)).toBeGreaterThan(wpmScore(60));
  });
  it("maps overall score to CEFR", () => {
    expect(cefrFromScore(overallScore(defaultSkills(20)))).toBe("A1");
    expect(cefrFromScore(90)).toBe("C2");
    expect(nextCefr("C2")).toBeNull();
    expect(nextCefr("B1")).toBe("B2");
  });
});

describe("mistake memory", () => {
  it("normalises pattern keys", () => {
    expect(normalizePatternKey("For vs Since!")).toBe("for_vs_since");
    expect(normalizePatternKey("")).toBe("general");
  });
  it("repeating a mistake schedules it for tomorrow and lowers ease", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const r = onMistakeRepeated({ ease: 2.5, intervalDays: 8, count: 2 }, now);
    expect(r.count).toBe(3);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBeCloseTo(2.3);
    expect(r.dueAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
  it("using it correctly grows the interval until mastered", () => {
    let s = { ease: 2.5, intervalDays: 1, count: 3 };
    let mastered = false;
    for (let i = 0; i < 6 && !mastered; i++) {
      const n = onUsedCorrectly(s);
      s = n;
      mastered = n.mastered;
    }
    expect(mastered).toBe(true);
  });
  it("focuses due items first, then frequent ones", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    const future = new Date(now.getTime() + 86_400_000);
    const pick = selectFocus(
      [
        { key: "a", label: "a", example: "", better: "", count: 9, dueAt: future, mastered: false },
        { key: "b", label: "b", example: "", better: "", count: 1, dueAt: past, mastered: false },
        { key: "c", label: "c", example: "", better: "", count: 50, dueAt: past, mastered: true },
      ],
      now,
      2,
    );
    expect(pick.map((p) => p.key)).toEqual(["b", "a"]);
  });
});

describe("gamification", () => {
  it("levels follow the XP curve", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpForLevel(2)).level).toBe(2);
    expect(levelFromXp(xpForLevel(5) - 1).level).toBe(4);
  });
  it("streaks continue on consecutive days and reset after a gap", () => {
    expect(nextStreak(null, "2026-03-10", 0)).toBe(1);
    expect(nextStreak("2026-03-09", "2026-03-10", 4)).toBe(5);
    expect(nextStreak("2026-03-10", "2026-03-10", 4)).toBe(4);
    expect(nextStreak("2026-03-07", "2026-03-10", 4)).toBe(1);
  });
});

describe("pronunciation", () => {
  it("tokenises", () => {
    expect(tokenize("I think, three!")).toEqual(["i", "think", "three"]);
  });
  it("aligns and flags missed words", () => {
    const w = alignWords(tokenize("I think three things"), tokenize("I sink three"));
    expect(w.map((x) => x.status)).toEqual(["good", "close", "good", "missed"]);
  });
  it("scores perfect repetition at 100 and gives L1 tips", () => {
    expect(scorePronunciation("We visited a very wide valley.", "we visited a very wide valley").score).toBe(100);
    const r = scorePronunciation("We visited a very wide valley.", "we wisited a wery wide", { nativeLanguage: "hi" });
    expect(r.score).toBeLessThan(90);
    expect(r.tips.join(" ")).toMatch(/V vs W/);
  });
});
