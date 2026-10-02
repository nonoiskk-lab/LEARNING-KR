import { currentUser, hashPassword, setSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { track } from "@/lib/analytics/track";
import { body, json, rateLimit } from "@/lib/http";

/** Upgrades the current guest (keeping all progress) or creates a new account. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`register:${ip}`, 10, 3_600_000)) return json({ error: "Too many attempts" }, 429);
  const b = await body<{ email?: string; password?: string; name?: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please enter a valid email" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
  if (await db.user.findUnique({ where: { email } })) return json({ error: "An account with this email already exists" }, 409);
  const passwordHash = await hashPassword(password);
  const guest = await currentUser();
  const user = guest?.isGuest
    ? await db.user.update({ where: { id: guest.id }, data: { email, passwordHash, isGuest: false, name: b.name || guest.name } })
    : await db.user.create({ data: { email, passwordHash, isGuest: false, name: b.name, subscription: { create: { plan: "free" } } } });
  await setSession(user.id);
  await track("account_created", user.id, { fromGuest: Boolean(guest?.isGuest) });
  return json({ ok: true });
}
