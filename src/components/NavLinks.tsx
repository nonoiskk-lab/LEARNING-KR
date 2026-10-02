"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Home", icon: "⌂" },
  { href: "/practice", label: "Practice", icon: "🎙" },
  { href: "/roleplay", label: "Roleplay", icon: "🎬" },
  { href: "/pronunciation", label: "Pronounce", icon: "🔊" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => path === href || (href !== "/app" && path.startsWith(href));
  if (variant === "top")
    return (
      <ul className="flex gap-1 text-sm">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`rounded-full px-3 py-1.5 transition ${active(n.href) ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="grid grid-cols-6">
      {NAV.map((n) => (
        <li key={n.href}>
          <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(n.href) ? "text-brand" : "text-muted"}`}>
            <span aria-hidden className="text-lg leading-none">{n.icon}</span>
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
