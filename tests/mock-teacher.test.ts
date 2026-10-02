import { describe, expect, it } from "vitest";
import { mockTeacherTurn } from "@/lib/ai/mock";
import { getMode } from "@/lib/config/modes";
import { TeacherTurnSchema } from "@/lib/ai/schema";
import { learnerContext } from "@/lib/ai/prompt";

const ctx = { nativeLanguage: "hi", cefr: "A2" as const, mode: getMode("free"), difficulty: "same" as const, focusMistakes: [], weakSkills: [], turnIndex: 0, advancedFeedback: false };
const turn = (text: string) => mockTeacherTurn({ context: ctx, history: [], learnerMessage: text, inputMode: "type" });

describe("offline demo teacher", () => {
  it("corrects the for/since + present perfect error from the brief", () => {
    const t = turn("I am working here since two years.");
    expect(t.corrections[0].patternKey).toBe("for_vs_since");
    expect(t.corrections[0].better).toBe("I have been working here for two years.");
    expect(t.reply).toContain("I've been working here for two years");
    expect(t.reply.trim().endsWith("?")).toBe(true);
  });
  it("never returns more than 3 corrections", () => {
    const t = turn("He go to office. I didn't went. I am agree it is more better, discuss about it.");
    expect(t.corrections.length).toBeLessThanOrEqual(3);
    expect(t.corrections.length).toBeGreaterThan(0);
  });
  it("bridges romanised Hindi to English", () => {
    const t = turn("Main kal office jaunga");
    expect(t.nativeBridge?.english).toBe("I will go to the office tomorrow.");
  });
  it("produces output that satisfies the Claude response schema", () => {
    expect(TeacherTurnSchema.safeParse(turn("I like cricket and movies very much")).success).toBe(true);
  });
  it("puts the learner's language and level into the prompt context", () => {
    const c = learnerContext(ctx);
    expect(c).toContain("Hindi");
    expect(c).toContain("A2");
  });
});
