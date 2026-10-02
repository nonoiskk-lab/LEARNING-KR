import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import BarChart from "@/components/BarChart";
import { currentUser, isAdmin } from "@/lib/auth";
import { adminDashboard } from "@/lib/services/admin";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const usd = (n: number, d = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function Admin() {
  const user = await currentUser();
  if (!isAdmin(user)) notFound();
  const d = await adminDashboard();
  const f = d.funnel;
  const funnel = [
    ["Signups", f.signup ?? 0],
    ["Onboarded", f.onboarding_complete ?? 0],
    ["Started a session", f.session_start ?? 0],
    ["Saw upgrade prompt", f.upgrade_prompt_shown ?? 0],
    ["Started checkout", f.checkout_started ?? 0],
    ["Subscribed", f.subscribed ?? 0],
  ] as const;
  const top = Math.max(1, ...funnel.map(([, n]) => n));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Admin · last 30 days</h1>
        <Link href="/app" className="text-sm text-muted">← App</Link>
      </header>

      <section aria-label="Revenue" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="MRR" value={usd(d.econ.mrr)} />
        <Kpi label="ARR" value={usd(d.econ.arr)} />
        <Kpi label="Paid users" value={String(d.users.paid)} />
        <Kpi label="Conversion" value={pct(d.econ.conversionRate)} />
        <Kpi label="Monthly churn" value={pct(d.econ.churn)} />
        <Kpi label="ARPU (active)" value={usd(d.econ.arpu, 2)} />
        <Kpi label="LTV" value={usd(d.econ.ltv)} />
        <Kpi label="CAC" value={d.econ.cac === null ? "—" : usd(d.econ.cac)} hint={d.econ.cac === null ? "add marketing spend" : undefined} />
        <Kpi label="LTV : CAC" value={d.econ.ltvToCac === null ? "—" : `${d.econ.ltvToCac.toFixed(1)}×`} />
        <Kpi label="AI cost / user" value={usd(d.econ.aiCostPerUser, 3)} />
        <Kpi label="AI cost (30d)" value={usd(d.usage.aiCostUsd, 2)} />
        <Kpi label="Gross margin" value={d.econ.mrr ? pct(d.econ.grossMargin) : "—"} warn={d.econ.mrr > 0 && d.econ.grossMargin < 0.6} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card p-6">
          <h2 className="mb-6 font-semibold">Daily active learners</h2>
          <BarChart data={d.dauSeries.map((x) => ({ x: x.day.slice(5), y: x.users }))} unit="learners" label="Daily active learners, last 30 days" height={160} />
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">Users</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Total</dt><dd className="text-right tabular-nums">{d.users.total}</dd>
            <dt className="text-muted">Registered</dt><dd className="text-right tabular-nums">{d.users.registered}</dd>
            <dt className="text-muted">Guests</dt><dd className="text-right tabular-nums">{d.users.guests}</dd>
            <dt className="text-muted">New (7d / 30d)</dt><dd className="text-right tabular-nums">{d.users.new7} / {d.users.new30}</dd>
            <dt className="text-muted">Active (30d)</dt><dd className="text-right tabular-nums">{d.users.active30}</dd>
            {d.planMix.map((p) => (
              <Fragment key={p.plan}><dt className="capitalize text-muted">{p.plan}</dt><dd className="text-right tabular-nums">{p.count}</dd></Fragment>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-6">
          <h2 className="font-semibold">Engagement & retention</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Sessions</dt><dd className="text-right tabular-nums">{d.engagement.sessions}</dd>
            <dt className="text-muted">Avg session</dt><dd className="text-right tabular-nums">{d.engagement.avgSessionMinutes.toFixed(1)} min</dd>
            <dt className="text-muted">Speaking minutes</dt><dd className="text-right tabular-nums">{d.engagement.speakingMinutes.toFixed(0)}</dd>
            <dt className="text-muted">D1 / D7 / D30</dt><dd className="text-right tabular-nums">{pct(d.engagement.d1)} / {pct(d.engagement.d7)} / {pct(d.engagement.d30)}</dd>
          </dl>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">AI infrastructure usage</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Avatar minutes</dt><dd className="text-right tabular-nums">{d.usage.avatarMinutes.toFixed(0)}</dd>
            <dt className="text-muted">Voice (STT) minutes</dt><dd className="text-right tabular-nums">{d.usage.voiceMinutes.toFixed(0)}</dd>
            <dt className="text-muted">TTS characters</dt><dd className="text-right tabular-nums">{d.usage.ttsChars.toLocaleString()}</dd>
            <dt className="text-muted">LLM tokens in / out</dt><dd className="text-right tabular-nums">{(d.usage.llmInputTokens / 1000).toFixed(0)}k / {(d.usage.llmOutputTokens / 1000).toFixed(0)}k</dd>
            <dt className="text-muted">AI cost / paid user</dt><dd className="text-right tabular-nums">{usd(d.econ.aiCostPerPaidUser, 2)}</dd>
          </dl>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">Conversion funnel</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {funnel.map(([label, n]) => (
              <li key={label}>
                <div className="flex justify-between"><span className="text-muted">{label}</span><span className="tabular-nums">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${(n / top) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Ranked title="Most-used lessons" rows={d.topLessons.map((l) => [l.name, l.count])} />
        <Ranked title="Most common mistakes" rows={d.topMistakes.map((m) => [m.label, m.count])} />
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{warn ? "⚠ " : ""}{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Ranked({ title, rows }: { title: string; rows: (readonly [string, number])[] | [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="card p-6">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">No data yet.</p> : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map(([name, n]) => (
            <li key={name}>
              <div className="flex justify-between"><span>{name}</span><span className="tabular-nums text-muted">{n}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
