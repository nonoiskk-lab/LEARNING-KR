"use client";

import Link from "next/link";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, name }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    window.location.href = "/app";
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-16 w-full max-w-sm space-y-4 p-6">
      <h1 className="font-display text-2xl">{mode === "login" ? "Welcome back" : "Save your progress"}</h1>
      {mode === "signup" && <p className="text-sm text-muted">Your streak, level and mistake memory come with you.</p>}
      {mode === "signup" && (
        <label className="block">
          <span className="label">Name</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </label>
      )}
      <label className="block">
        <span className="label">Email</span>
        <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input className="input mt-1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </label>
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{mode === "login" ? "Log in" : "Create account"}</button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New here? <Link href="/onboarding" className="underline">Start free</Link></> : <>Have an account? <Link href="/login" className="underline">Log in</Link></>}
      </p>
    </form>
  );
}
