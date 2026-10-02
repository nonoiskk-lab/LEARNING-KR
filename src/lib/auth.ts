import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "fl_session";
const MAX_AGE = 60 * 60 * 24 * 90;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, "base64");
  const test = await scrypt(pw, Buffer.from(saltB64, "base64"), key.length);
  return timingSafeEqual(key, test);
}

export async function setSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { subscription: true } });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export function isAdmin(user: { email: string | null; role: string } | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(user.email && admins.includes(user.email.toLowerCase()));
}

/** Guest-first: learners start speaking before creating an account. */
export async function getOrCreateGuest(source?: string | null) {
  const existing = await currentUser();
  if (existing) return existing;
  const user = await db.user.create({
    data: { isGuest: true, acquisitionSource: source ?? null, subscription: { create: { plan: "free" } } },
    include: { subscription: true },
  });
  await db.analyticsEvent.create({ data: { userId: user.id, name: "signup", props: JSON.stringify({ guest: true, source }) } });
  await setSession(user.id);
  return user;
}
