import { currentUser, isAdmin } from "@/lib/auth";
import { adminDashboard } from "@/lib/services/admin";
import { json } from "@/lib/http";

export async function GET() {
  const user = await currentUser();
  if (!isAdmin(user)) return json({ error: "Forbidden" }, 403);
  return json(await adminDashboard());
}
