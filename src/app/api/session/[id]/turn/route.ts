import { currentUser } from "@/lib/auth";
import { processTurn } from "@/lib/services/learning";
import { body, errorResponse, json, rateLimit } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    if (!rateLimit(`turn:${user.id}`, 20, 60_000)) return json({ error: "You're going fast! Take a breath and try again in a moment." }, 429);
    const { id } = await params;
    const b = await body<{ text?: string; inputMode?: "speak" | "type"; sttConfidence?: number; speakingSeconds?: number }>(req);
    const out = await processTurn(user, {
      sessionId: id,
      text: String(b.text ?? ""),
      inputMode: b.inputMode === "speak" ? "speak" : "type",
      sttConfidence: typeof b.sttConfidence === "number" ? b.sttConfidence : undefined,
      speakingSeconds: typeof b.speakingSeconds === "number" ? Math.min(300, b.speakingSeconds) : undefined,
    });
    return json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
