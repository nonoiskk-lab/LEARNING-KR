"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

interface Props {
  user: { name: string; email: string | null; isGuest: boolean; nativeLanguage: string; voiceSpeed: number; voiceStyle: string; textSize: string; voiceConsent: boolean; cefr: string };
  plan: { id: string; name: string; status: string; renews: string | null };
  languages: { code: string; name: string; native: string }[];
  isAdmin: boolean;
}

export default function ProfileClient({ user, plan, languages, isAdmin }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(user);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  async function save(patch: Partial<Props["user"]>) {
    const next = { ...form, ...patch };
    setForm(next);
    await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: next.name, nativeLanguage: next.nativeLanguage, voiceSpeed: next.voiceSpeed, voiceStyle: next.voiceStyle, textSize: next.textSize, voiceConsent: next.voiceConsent }) });
    if (patch.textSize) document.documentElement.dataset.text = patch.textSize;
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function manage() {
    const r = await fetch("/api/billing/portal", { method: "POST" });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  }

  async function del() {
    await fetch("/api/me", { method: "DELETE" });
    window.location.href = "/";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Learning</h2>
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => save({})} />
        </Field>
        <Field label="Language I'm most comfortable speaking">
          <select className="input" value={form.nativeLanguage} onChange={(e) => save({ nativeLanguage: e.target.value })}>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.name} — {l.native}</option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-muted">Current level: <b className="text-text">{user.cefr}</b> · <Link className="underline" href="/practice?mode=assessment">Retake level check</Link></p>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Voice & accessibility</h2>
        <Field label="Teacher voice speed">
          <div className="flex gap-2">
            {[0.75, 1, 1.25, 1.5].map((s) => (
              <button key={s} className={`chip ${form.voiceSpeed === s ? "!border-brand !text-text" : ""}`} aria-pressed={form.voiceSpeed === s} onClick={() => save({ voiceSpeed: s })}>{s}x</button>
            ))}
          </div>
        </Field>
        <Field label="Voice style">
          <div className="flex gap-2">
            {["warm", "clear", "energetic"].map((s) => (
              <button key={s} className={`chip capitalize ${form.voiceStyle === s ? "!border-brand !text-text" : ""}`} aria-pressed={form.voiceStyle === s} onClick={() => save({ voiceStyle: s })}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Text size">
          <div className="flex gap-2">
            {[["sm", "A-"], ["md", "A"], ["lg", "A+"], ["xl", "A++"]].map(([k, l]) => (
              <button key={k} className={`chip ${form.textSize === k ? "!border-brand !text-text" : ""}`} aria-pressed={form.textSize === k} onClick={() => save({ textSize: k })}>{l}</button>
            ))}
          </div>
        </Field>
        {saved && <p className="text-xs text-good" role="status">Saved ✓</p>}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">Plan</h2>
        <p>
          <b>{plan.name}</b> <span className="text-sm text-muted">· {plan.status}{plan.renews ? ` · renews ${plan.renews}` : ""}</span>
        </p>
        {plan.id === "free" ? (
          <Link href="/pricing?from=profile" className="btn btn-primary">Upgrade — 7 days free</Link>
        ) : (
          <button className="btn btn-ghost" onClick={manage}>Manage subscription</button>
        )}
        {isAdmin && <Link href="/admin" className="block text-sm text-brand">Open admin dashboard →</Link>}
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">Account</h2>
        {user.isGuest ? (
          <>
            <p className="text-sm text-muted">You&apos;re practising as a guest. Create an account to keep your progress on any device.</p>
            <div className="flex gap-2">
              <Link href="/signup" className="btn btn-primary">Create account</Link>
              <Link href="/login" className="btn btn-ghost">Log in</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">{user.email}</p>
            <button className="btn btn-ghost" onClick={logout}>Log out</button>
          </>
        )}
      </section>

      <section className="card space-y-3 p-6 md:col-span-2" aria-labelledby="privacy">
        <h2 id="privacy" className="font-semibold">Privacy & data</h2>
        <p className="text-sm text-muted">
          Maya is an AI teacher. Speech is transcribed by your browser&apos;s speech service; we keep the text of your conversations to personalise lessons and never store raw audio. You control your data.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.voiceConsent} onChange={(e) => save({ voiceConsent: e.target.checked })} />
          Allow voice processing for speaking practice
        </label>
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export" className="btn btn-ghost">Download my data</a>
        </div>
        <div className="rounded-2xl border border-bad/40 p-4">
          <p className="text-sm">Delete my account and all learning data permanently. Type <b>DELETE</b> to confirm.</p>
          <div className="mt-2 flex gap-2">
            <label htmlFor="del" className="sr-only">Type DELETE to confirm</label>
            <input id="del" className="input max-w-40" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
            <button className="btn border border-bad/60 text-bad disabled:opacity-40" disabled={confirmDelete !== "DELETE"} onClick={del}>Delete everything</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-1.5">{label}</p>
      {children}
    </div>
  );
}
