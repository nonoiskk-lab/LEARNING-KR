import "server-only";
import { db } from "../db";

export async function track(name: string, userId: string | null, props?: Record<string, unknown>) {
  try {
    await db.analyticsEvent.create({ data: { name, userId, props: props ? JSON.stringify(props) : null } });
  } catch (err) {
    // analytics must never break the product
    console.error("track failed", name, err);
  }
}
