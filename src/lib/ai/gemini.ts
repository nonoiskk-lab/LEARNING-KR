import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";
import { z } from "zod/v4";
import { TEACHER_SYSTEM, learnerContext } from "./prompt";
import { TeacherTurnSchema, type TeacherTurn } from "./schema";
import type { HistoryItem, TeacherRequest } from "./teacher";

/**
 * Google Gemini as an alternative teacher brain (TEACHER_PROVIDER=gemini).
 * Same contract as the Claude path: one structured JSON turn validated
 * against TeacherTurnSchema.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const HISTORY_WINDOW = 16;

export class TeacherBusyError extends Error {
  constructor() {
    super("Maya is taking a short break — the AI usage limit was reached. Please try again in a minute.");
  }
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Gemini's JSON-schema support is a subset: drop keys it doesn't need. Zod re-validates the result anyway. */
export function geminiResponseSchema(): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "additionalProperties") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return strip(z.toJSONSchema(TeacherTurnSchema));
}

export function toGeminiContents(history: HistoryItem[], learnerMessage: string): Content[] {
  const contents: Content[] = [];
  const push = (role: "user" | "model", text: string) => {
    const last = contents[contents.length - 1];
    if (last?.role === role && last.parts?.[0]?.text !== undefined) last.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  };
  const hist = history.slice(-HISTORY_WINDOW);
  if (hist[0]?.role === "teacher") push("user", "(The learner opened the app and the session started.)");
  for (const h of hist) push(h.role === "user" ? "user" : "model", h.text);
  push("user", learnerMessage);
  return contents;
}

/** Parse and validate the model's JSON. Returns null when it doesn't match the schema. */
export function parseGeminiTurn(text: string | undefined): TeacherTurn | null {
  if (!text) return null;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const r = TeacherTurnSchema.safeParse(JSON.parse(cleaned));
    return r.success ? { ...r.data, corrections: r.data.corrections.slice(0, 3) } : null;
  } catch {
    return null;
  }
}

/** USD per million tokens. 0 by default because the free tier costs nothing; set paid rates in env. */
export function geminiCostMicroUsd(inputTokens: number, outputTokens: number): number {
  const pin = Number(process.env.GEMINI_PRICE_INPUT_PER_MTOK || 0);
  const pout = Number(process.env.GEMINI_PRICE_OUTPUT_PER_MTOK || 0);
  return Math.round(inputTokens * pin + outputTokens * pout);
}

export async function geminiTeacherTurn(req: TeacherRequest, learnerMessage: string) {
  const level = (process.env.GEMINI_THINKING_LEVEL ?? "LOW").toUpperCase();
  let response;
  try {
    response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: toGeminiContents(req.history, learnerMessage),
      config: {
        systemInstruction: `${TEACHER_SYSTEM}\n\n${learnerContext(req.context)}\n\nRespond ONLY with JSON matching the response schema.`,
        responseMimeType: "application/json",
        responseJsonSchema: geminiResponseSchema(),
        maxOutputTokens: 4000,
        // Low thinking keeps conversation snappy. Set GEMINI_THINKING_LEVEL="" for models that don't support it.
        ...(level && level in ThinkingLevel ? { thinkingConfig: { thinkingLevel: ThinkingLevel[level as keyof typeof ThinkingLevel] } } : {}),
      },
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 429 || err.status === 503)) throw new TeacherBusyError();
    throw err;
  }

  const u = response.usageMetadata;
  const inputTokens = u?.promptTokenCount ?? 0;
  const outputTokens = (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);
  return {
    turn: parseGeminiTurn(response.text),
    // promptTokenCount already includes any cached tokens, so they are not counted separately.
    usage: { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 },
    costMicroUsd: geminiCostMicroUsd(inputTokens, outputTokens),
    model: GEMINI_MODEL,
  };
}
