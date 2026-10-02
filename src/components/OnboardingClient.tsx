"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import TeacherAvatar, { type AvatarState } from "./TeacherAvatar";
import { speak, voicesReady } from "@/lib/voice/client";
import type { NativeLanguage } from "@/lib/config/languages";

type Step = "welcome" | "language" | "level" | "ready";

interface Props {
  languages: NativeLanguage[];
  levels: { id: string; label: string; hint: string }[];
}

export default function OnboardingClient({ languages, levels }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState<Step>(sp.get("step") === "language" ? "language" : "welcome");
  const [lang, setLang] = useState<string | null>(null);
  const [state, setState] = useState<AvatarState>("idle");
  const [busy, setBusy] = useState(false);
  const levelRef = useRef(0);
  const shapeRef = useRef(0);
  const voice = useRef(true);

  async function talk(text: string) {
    if (!voice.current) return;
    await voicesReady();
    setState("speaking");
    await speak(text, { rate: 1, onLevel: (l, r) => { levelRef.current = l; shapeRef.current = r; } });
    setState("idle");
  }

  async function choose(mode: "speak" | "type") {
    voice.current = mode === "speak";
    setStep("language");
    void talk("What language do you normally speak?");
  }

  async function finish(level: string) {
    setBusy(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nativeLanguage: lang, level, source: sp.get("utm_source") ?? (document.referrer ? new URL(document.referrer).hostname : null) }),
    });
    const data = await res.json();
    if (data.needsAssessment || sp.get("try")) {
      setStep("ready");
      await talk("Let's have a quick conversation so I can understand your English level.");
      router.push("/practice?mode=assessment");
    } else {
      router.push("/app?welcome=1");
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-8 px-4 py-8 md:grid-cols-[1fr_1.2fr]">
      <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-line" style={{ background: "radial-gradient(120% 90% at 50% 10%, #2a3b55 0%, #121a28 60%, #0b111b 100%)" }}>
        <TeacherAvatar state={state} emotion={step === "ready" ? "encourage" : "smile"} levelRef={levelRef} shapeRef={shapeRef} className="h-[38dvh] w-full md:h-[56dvh]" />
        <span className="chip absolute right-3 top-3 bg-ink/60 text-xs">🤖 AI teacher</span>
      </div>

      <div className="rise" key={step}>
        {step === "welcome" && (
          <div>
            <h1 className="font-display text-4xl leading-tight">Hi! I&apos;m your AI English Coach. 👋</h1>
            <p className="mt-3 text-lg text-muted">I&apos;ll help you become more confident speaking English. How would you like to talk with me?</p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button className="btn btn-primary flex-col !rounded-3xl py-6 text-lg" onClick={() => choose("speak")}>
                <span className="text-3xl">🎙️</span>SPEAK
              </button>
              <button className="btn btn-ghost flex-col !rounded-3xl py-6 text-lg" onClick={() => choose("type")}>
                <span className="text-3xl">⌨️</span>TYPE
              </button>
            </div>
            <p className="mt-4 text-xs text-muted">You can switch any time. Maya is an AI — not a human.</p>
          </div>
        )}

        {step === "language" && (
          <div>
            <h1 className="font-display text-3xl">What language do you normally speak?</h1>
            <p className="mt-2 text-muted">I&apos;ll use it as a bridge when you get stuck.</p>
            <div className="mt-6 grid max-h-[50dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {languages.map((l) => (
                <button
                  key={l.code}
                  lang={l.code}
                  dir={l.rtl ? "rtl" : undefined}
                  onClick={() => {
                    setLang(l.code);
                    setStep("level");
                    void talk("And what is your English level?");
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left transition hover:border-brand/60 ${lang === l.code ? "border-brand bg-panel-2" : "border-line"}`}
                >
                  <span className="block font-semibold">{l.native}</span>
                  <span className="text-xs text-muted">{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "level" && (
          <div>
            <h1 className="font-display text-3xl">What is your English level?</h1>
            <div className="mt-6 grid gap-2">
              {levels.map((l) => (
                <button key={l.id} disabled={busy} onClick={() => finish(l.id)} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3.5 text-left transition hover:border-brand/60 disabled:opacity-50">
                  <span>
                    <span className="font-semibold">{l.label}</span>
                    <span className="block text-sm text-muted">{l.hint}</span>
                  </span>
                  <span aria-hidden>→</span>
                </button>
              ))}
            </div>
            <button className="mt-4 text-sm text-muted underline" onClick={() => setStep("language")}>← Back</button>
          </div>
        )}

        {step === "ready" && (
          <div>
            <h1 className="font-display text-3xl">Let&apos;s have a quick conversation so I can understand your English level.</h1>
            <p className="mt-3 text-muted">Just talk naturally — there are no wrong answers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
