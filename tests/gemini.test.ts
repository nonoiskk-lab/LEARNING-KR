import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiCostMicroUsd, geminiResponseSchema, parseGeminiTurn, toGeminiContents } from "@/lib/ai/gemini";
import { teacherProvider } from "@/lib/ai/teacher";
import { mockTeacherTurn } from "@/lib/ai/mock";
import { getMode } from "@/lib/config/modes";

afterEach(() => vi.unstubAllEnvs());

const validTurn = () =>
  mockTeacherTurn({
    context: { nativeLanguage: "hi", cefr: "A2", mode: getMode("free"), difficulty: "same", focusMistakes: [], weakSkills: [], turnIndex: 0, advancedFeedback: false },
    history: [],
    learnerMessage: "I am working here since two years.",
    inputMode: "type",
  });

describe("provider selection", () => {
  it("prefers Claude, then Gemini, then the demo tutor", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("TEACHER_PROVIDER", "");
    expect(teacherProvider()).toBe("demo");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(teacherProvider()).toBe("gemini");
    vi.stubEnv("ANTHROPIC_API_KEY", "a");
    expect(teacherProvider()).toBe("claude");
  });
  it("honours TEACHER_PROVIDER but never picks a provider without a key", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "a");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("TEACHER_PROVIDER", "gemini");
    expect(teacherProvider()).toBe("gemini");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(teacherProvider()).toBe("demo");
  });
});

describe("gemini adapter", () => {
  it("builds alternating user/model contents starting with the user", () => {
    const c = toGeminiContents(
      [
        { role: "teacher", text: "Hi! What do you do?" },
        { role: "user", text: "I am engineer" },
        { role: "teacher", text: "Nice!" },
      ],
      "[typed] I like it",
    );
    expect(c.map((x) => x.role)).toEqual(["user", "model", "user", "model", "user"]);
    expect(c[c.length - 1].parts?.[0].text).toBe("[typed] I like it");
  });
  it("sends a schema without keys Gemini doesn't need", () => {
    const s = JSON.stringify(geminiResponseSchema());
    expect(s).not.toContain("additionalProperties");
    expect(s).not.toContain("$schema");
    expect(s).toContain("corrections");
  });
  it("parses valid JSON (also inside code fences) and caps corrections at 3", () => {
    const t = validTurn();
    const many = { ...t, corrections: Array(5).fill(t.corrections[0]) };
    expect(parseGeminiTurn(JSON.stringify(t))?.reply).toBe(t.reply);
    expect(parseGeminiTurn("```json\n" + JSON.stringify(many) + "\n```")?.corrections.length).toBe(3);
  });
  it("rejects output that doesn't match the schema", () => {
    expect(parseGeminiTurn(undefined)).toBeNull();
    expect(parseGeminiTurn("not json")).toBeNull();
    expect(parseGeminiTurn(JSON.stringify({ reply: "hi" }))).toBeNull();
  });
  it("costs nothing on the free tier and uses configured paid rates", () => {
    vi.stubEnv("GEMINI_PRICE_INPUT_PER_MTOK", "");
    vi.stubEnv("GEMINI_PRICE_OUTPUT_PER_MTOK", "");
    expect(geminiCostMicroUsd(1e6, 1e6)).toBe(0);
    vi.stubEnv("GEMINI_PRICE_INPUT_PER_MTOK", "0.75");
    vi.stubEnv("GEMINI_PRICE_OUTPUT_PER_MTOK", "4");
    expect(geminiCostMicroUsd(1e6, 1e6)).toBe(4.75e6);
  });
});
