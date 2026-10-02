import { currentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics/track";
import { body, json } from "@/lib/http";

const ALLOWED = new Set(["upgrade_prompt_shown", "upgrade_prompt_clicked", "pricing_viewed", "landing_cta", "voice_toggled", "mic_denied"]);

export async function POST(req: Request) {
  const b = await body<{ name?: string; props?: Record<string, unknown> }>(req);
  if (!b.name || !ALLOWED.has(b.name)) return json({ ok: false }, 400);
  await track(b.name, await currentUserId(), b.props);
  return json({ ok: true });
}
