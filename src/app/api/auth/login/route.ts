import { setSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { body, json, rateLimit } from "@/lib/http";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}`, 20, 900_000)) return json({ error: "Too many attempts, try again later" }, 429);
  const b = await body<{ email?: string; password?: string }>(req);
  const user = await db.user.findUnique({ where: { email: String(b.email ?? "").trim().toLowerCase() } });
  if (!user?.passwordHash || !(await verifyPassword(String(b.password ?? ""), user.passwordHash))) return json({ error: "Email or password is incorrect" }, 401);
  await setSession(user.id);
  return json({ ok: true });
}
