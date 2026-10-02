import { currentUser, getOrCreateGuest } from "@/lib/auth";
import { startSession } from "@/lib/services/learning";
import { body, errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const b = await body<{ mode?: string; scenarioId?: string }>(req);
    const user = (await currentUser()) ?? (await getOrCreateGuest());
    const s = await startSession(user, b.mode ?? "free", b.scenarioId);
    return json({ sessionId: s.id, mode: s.mode, scenarioId: s.scenarioId, opener: s.messages[0] });
  } catch (e) {
    return errorResponse(e);
  }
}
