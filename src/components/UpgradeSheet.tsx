"use client";

import Link from "next/link";
import { useEffect } from "react";

export interface UpgradeInfo {
  title: string;
  body: string;
}

/** Contextual upgrade moment. Shown only at natural stopping points, always dismissible. */
export default function UpgradeSheet({ info, onClose, source }: { info: UpgradeInfo; onClose: () => void; source: string }) {
  useEffect(() => {
    fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "upgrade_prompt_shown", props: { source } }) }).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onClick={onClose}>
      <div className="card rise w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <p className="label mb-2">Fluentia Premium</p>
        <h2 id="upgrade-title" className="font-display text-2xl">{info.title}</h2>
        <p className="mt-2 text-muted">{info.body}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li>✓ Unlimited conversations & roleplays</li>
          <li>✓ Business English & interview practice</li>
          <li>✓ Mistake memory & a personal plan</li>
          <li>✓ 7-day free trial · cancel anytime</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <Link
            href={`/pricing?from=${source}`}
            className="btn btn-primary flex-1"
            onClick={() => fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "upgrade_prompt_clicked", props: { source } }) })}
          >
            See plans
          </Link>
          <button className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
