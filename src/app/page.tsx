import Link from "next/link";
import HeroDemo from "@/components/HeroDemo";
import { LANGUAGES } from "@/lib/config/languages";
import { MODES } from "@/lib/config/modes";
import { PLANS } from "@/lib/config/plans";

export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-2xl font-semibold">Fluentia<span className="text-brand">.</span></span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/pricing" className="hidden px-3 py-2 text-muted hover:text-text sm:block">Pricing</Link>
          <Link href="/login" className="px-3 py-2 text-muted hover:text-text">Log in</Link>
          <Link href="/onboarding" className="btn btn-primary !py-2 text-sm">Start free</Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 md:grid-cols-[1.1fr_1fr] md:pt-12">
        <div>
          <p className="chip inline-block">Your personal AI English teacher · 24/7</p>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] md:text-6xl">Speak English<br />with <span className="text-brand">Confidence.</span></h1>
          <p className="mt-5 max-w-lg text-lg text-muted">Practice real conversations with your personal AI English teacher — anytime, anywhere. Make mistakes safely, get gently corrected, and hear yourself improve.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="btn btn-primary px-8 py-4 text-lg">🎙️ Start Speaking Free</Link>
            <Link href="/onboarding?try=1" className="btn btn-ghost px-6 py-4">Try a Conversation</Link>
          </div>
          <p className="mt-4 text-sm text-muted">No credit card · Learn from Hindi, Bengali, Tamil, Spanish, Arabic and {LANGUAGES.length - 5}+ more</p>
        </div>
        <HeroDemo />
      </section>

      {/* LANGUAGES */}
      <section className="border-y border-line bg-panel/40 py-6" aria-label="Supported languages">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 px-4">
          {LANGUAGES.map((l) => (
            <li key={l.code} className="chip" lang={l.code}>{l.native}</li>
          ))}
        </ul>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center font-display text-4xl">Not a chatbot. A teacher.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">Every conversation follows a learning loop: Maya listens, understands, corrects only what matters, teaches, asks again — and remembers your mistakes for next time.</p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["🎙️", "Speak naturally", "Tap the mic and talk — or type. Use your own language when you're stuck; Maya builds the bridge to English."],
            ["✨", "Get gently corrected", "Max 1–3 important corrections per turn, explained simply. Then the conversation continues — never a grammar exam."],
            ["📈", "Visibly improve", "Your speaking, grammar, vocabulary, pronunciation, fluency and confidence are tracked as you go from A1 to C2."],
          ].map(([i, t, d]) => (
            <div key={t} className="card p-6">
              <div className="text-3xl" aria-hidden>{i}</div>
              <h3 className="mt-3 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CORRECTION EXAMPLE */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-20 md:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl">Corrections that feel like encouragement.</h2>
          <p className="mt-4 text-muted">Maya picks the most important mistake, shows you the natural way to say it, and explains why in one line. Repeated mistakes become your personal practice plan.</p>
        </div>
        <div className="card space-y-3 p-6 text-sm">
          <div className="ml-auto max-w-[85%] rounded-2xl bg-brand/15 px-4 py-2.5">🎙 I am working here since two years.</div>
          <div className="max-w-[85%] rounded-2xl bg-panel-2 px-4 py-2.5">Nice! I understand what you mean. A more natural way to say that is: “I&apos;ve been working here for two years.” Now let me ask you something…</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-2xl border border-line p-4">
            <dt className="label">You said</dt><dd className="text-muted line-through">I am working here since two years.</dd>
            <dt className="label">Better</dt><dd>I have been working here for two years.</dd>
            <dt className="label">Natural</dt><dd className="text-good">I&apos;ve been working here for two years.</dd>
            <dt className="label">Why</dt><dd className="text-muted">Use &quot;for&quot; with a length of time and &quot;have been + -ing&quot; for something still happening.</dd>
          </dl>
        </div>
      </section>

      {/* MODES */}
      <section className="border-t border-line bg-panel/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-display text-4xl">Practice for real life</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {MODES.filter((m) => m.id !== "assessment").map((m) => (
              <div key={m.id} className="card p-5">
                <div className="text-2xl" aria-hidden>{m.icon}</div>
                <h3 className="mt-2 font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted">{m.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center font-display text-4xl">Start free. Upgrade when you&apos;re ready.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className={`card p-6 ${p.highlight ? "border-brand/60" : ""}`}>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-semibold">{p.priceDisplay.month}</p>
              <p className="text-sm text-muted">{p.tagline}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.slice(0, 4).map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center"><Link href="/pricing" className="text-brand underline">Compare plans</Link></p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="font-display text-3xl">Questions</h2>
        {[
          ["Is Maya a real person?", "No. Maya is an AI teacher, and we always say so. She's designed to be patient, encouraging and available whenever you want to practise."],
          ["Do I need to be good at English already?", "Not at all. Beginners can start with simple sentences and use their own language as a bridge. Maya adapts to your level automatically."],
          ["What happens to my voice?", "Your browser converts speech to text. We store the text to track your progress — not your audio — and you can download or delete your data any time."],
          ["Can I use it on my phone?", "Yes — Fluentia is designed mobile-first with one-hand controls and a big microphone button."],
        ].map(([q, a]) => (
          <details key={q} className="border-b border-line py-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-muted">{a}</p>
          </details>
        ))}
      </section>

      <section className="px-4 pb-24 text-center">
        <h2 className="font-display text-4xl">From “I understand but can&apos;t speak”<br />to “I can speak confidently.”</h2>
        <Link href="/onboarding" className="btn btn-primary mt-8 px-10 py-4 text-lg">Start Speaking Free</Link>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} Fluentia · Maya is an AI teacher · <Link href="/pricing" className="underline">Pricing</Link> · For teams & schools: contact sales
      </footer>
    </div>
  );
}
