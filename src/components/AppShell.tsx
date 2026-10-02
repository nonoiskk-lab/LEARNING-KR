import Link from "next/link";
import NavLinks from "./NavLinks";


export default function AppShell({ children, textSize = "md", streak, xp }: { children: React.ReactNode; textSize?: string; streak?: number; xp?: number }) {
  return (
    <div data-text={textSize} className="min-h-dvh overflow-x-clip pb-24 md:pb-0">
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.dataset.text=${JSON.stringify(textSize)}` }} />
      <header className="sticky top-0 z-30 border-b border-line/60 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/app" className="font-display text-xl font-semibold tracking-tight">
            Fluentia<span className="text-brand">.</span>
          </Link>
          <nav className="hidden flex-1 md:block" aria-label="Main">
            <NavLinks variant="top" />
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted md:ml-0">
            {typeof streak === "number" && <span title="Daily streak">🔥 {streak}</span>}
            {typeof xp === "number" && <span title="Experience points">⚡ {xp} XP</span>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
