import { currentUser } from "@/lib/auth";
import { endSession } from "@/lib/services/learning";
import { errorResponse, json } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "Not signed in" }, 401);
    const { id } = await params;
    return json({ summary: await endSession(user.id, id) });
  } catch (e) {
    return errorResponse(e);
  }
}
