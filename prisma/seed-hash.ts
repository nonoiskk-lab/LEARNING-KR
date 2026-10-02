import { randomBytes, scryptSync } from "node:crypto";

/** Same format as src/lib/auth.ts (which is server-only and can't be imported by a script). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 64).toString("base64")}`;
}
