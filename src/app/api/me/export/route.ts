import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

/** Data portability: everything we store about the learner as JSON. */
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  const data = await db.user.findUnique({
    where: { id: user.id },
    include: { subscription: true, skills: true, mistakes: true, vocabulary: true, achievements: true, usage: true, sessions: { include: { messages: true } } },
  });
  const { passwordHash: _omit, ...safe } = data!;
  return new Response(JSON.stringify(safe, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="fluentia-my-data.json"' },
  });
}
