import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { TEACHER_SYSTEM, learnerContext, type LearnerContextInput } from "./prompt";
import { TeacherTurnSchema, type TeacherTurn } from "./schema";
import { mockTeacherTurn } from "./mock";

export interface HistoryItem {
  role: "user" | "teacher";
  text: string;
}

export interface TeacherRequest {
  context: LearnerContextInput;
  history: HistoryItem[]; // oldest first, NOT including the new learner message
  learnerMessage: string;
  inputMode: "speak" | "type";
  sttConfidence?: number;
}

export interface TeacherResult {
  turn: TeacherTurn;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
  costMicroUsd: number;
  provider: "claude" | "demo";
  model: string;
}

const MODEL = process.env.TEACHER_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.TEACHER_EFFORT || "low") as "low" | "medium" | "high";
/** Keep the last N exchanges verbatim; older context lives in mistake memory and skills. */
const HISTORY_WINDOW = 16;

/** USD per million tokens. Keep in sync with Anthropic pricing for the configured model. */
const PRICE_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

let client: Anthropic | null = null;
export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 2 });
  return client;
}

export function costMicroUsd(model: string, u: TeacherResult["usage"]): number {
  const p = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK["claude-opus-5-5"];
  // price per MTok == micro-USD per token
  return Math.round(u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite);
}

function buildMessages(req: TeacherRequest): Anthropic.Beta.BetaMessageParam[] {
  const hist = req.history.slice(-HISTORY_WINDOW);
  const msgs: Anthropic.Beta.BetaMessageParam[] = [];
  // The API needs the first message to be from the user; the session opener is a teacher line.
  if (hist[0]?.role === "teacher") msgs.push({ role: "user", content: "(The learner opened the app and the session started.)" });
  for (const h of hist) {
    const role = h.role === "user" ? "user" : "assistant";
    const last = msgs[msgs.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content += `\n${h.text}`;
    else msgs.push({ role, content: h.text });
  }
  const meta =
    req.inputMode === "speak"
      ? `[spoken via speech recognition${typeof req.sttConfidence === "number" ? `, recogniser confidence ${req.sttConfidence.toFixed(2)}` : ""}]`
      : "[typed]";
  const learner = `${meta} ${req.learnerMessage}`;
  const last = msgs[msgs.length - 1];
  if (last && last.role === "user" && typeof last.content === "string") last.content += `\n${learner}`;
  else msgs.push({ role: "user", content: learner });
  return msgs;
}

export async function teacherTurn(req: TeacherRequest): Promise<TeacherResult> {
  if (!aiEnabled()) {
    return {
      turn: mockTeacherTurn(req),
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costMicroUsd: 0,
      provider: "demo",
      model: "demo",
    };
  }

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: betaZodOutputFormat(TeacherTurnSchema) },
    system: [
      // Stable persona/rules first so the prefix caches across all learners.
      { type: "text", text: TEACHER_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: learnerContext(req.context) },
    ],
    messages: buildMessages(req),
  });

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  };

  let turn: TeacherTurn;
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    // Safety decline or unparseable output: keep the conversation alive gracefully.
    turn = {
      ...mockTeacherTurn(req),
      reply: "Hmm, let's take that in a different direction. Tell me about something you enjoyed doing this week?",
      corrections: [],
    };
  } else {
    turn = response.parsed_output;
    turn.corrections = turn.corrections.slice(0, 3);
  }

  return { turn, usage, costMicroUsd: costMicroUsd(response.model || MODEL, usage), provider: "claude", model: response.model || MODEL };
}
