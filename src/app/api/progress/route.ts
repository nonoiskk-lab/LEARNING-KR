import { currentUser } from "@/lib/auth";
import { progressSnapshot } from "@/lib/services/progress";
import { json } from "@/lib/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  return json(await progressSnapshot(user.id));
}
