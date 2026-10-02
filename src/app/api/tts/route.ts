import { currentUser } from "@/lib/auth";
import { json, rateLimit } from "@/lib/http";

/**
 * Premium neural voice. When TTS_PROVIDER=elevenlabs this streams MP3 audio;
 * otherwise it returns 204 and the client uses the browser's speech engine.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  if (process.env.TTS_PROVIDER !== "elevenlabs" || !process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) return new Response(null, { status: 204 });
  if (!rateLimit(`tts:${user.id}`, 40, 60_000)) return json({ error: "rate limited" }, 429);
  const { text, speed } = (await req.json().catch(() => ({}))) as { text?: string; speed?: number };
  if (!text) return json({ error: "No text" }, 400);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream?optimize_streaming_latency=2`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: text.slice(0, 1200),
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed ?? 1)) },
    }),
  });
  if (!res.ok || !res.body) return new Response(null, { status: 204 });
  return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
