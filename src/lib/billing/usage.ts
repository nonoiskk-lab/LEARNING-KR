import "server-only";
import { db } from "../db";
import { dayKey } from "../learning/gamification";

export type UsageField =
  | "conversations"
  | "teacherTurns"
  | "avatarSeconds"
  | "speakingSeconds"
  | "roleplays"
  | "pronunciationDrills"
  | "llmInputTokens"
  | "llmOutputTokens"
  | "ttsChars"
  | "sttSeconds"
  | "costMicroUsd";

export async function todayUsage(userId: string) {
  const day = dayKey();
  return db.usageDay.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} });
}

export async function addUsage(userId: string, inc: Partial<Record<UsageField, number>>) {
  const day = dayKey();
  const data = Object.fromEntries(Object.entries(inc).filter(([, v]) => v).map(([k, v]) => [k, { increment: Math.round(v as number) }]));
  return db.usageDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, ...Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, Math.round(v ?? 0)])) },
    update: data,
  });
}
