import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/onboarding");
  return (
    <AppShell textSize={user.textSize} streak={user.streakDays} xp={user.xp}>
      {children}
    </AppShell>
  );
}
