import { NextResponse } from "next/server";
import { LimitError } from "./services/learning";
import { TeacherBusyError } from "./ai/gemini";

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function errorResponse(err: unknown) {
  if (err instanceof LimitError) return json({ error: "limit", kind: err.kind, upgrade: err.upgrade }, 402);
  if (err instanceof TeacherBusyError) return json({ error: err.message }, 503);
  console.error(err);
  const message = err instanceof Error ? err.message : "Something went wrong";
  return json({ error: message }, 400);
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Simple fixed-window in-memory rate limit per key. Use Redis/Upstash in multi-instance prod. */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}
