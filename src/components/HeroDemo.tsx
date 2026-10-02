"use client";

import { useEffect, useRef, useState } from "react";
import TeacherAvatar, { type AvatarState } from "./TeacherAvatar";
import type { Emotion } from "@/lib/ai/schema";

const SCRIPT: { who: "user" | "teacher"; text: string; emotion?: Emotion }[] = [
  { who: "teacher", text: "Hi! I'm Maya. What do you do?", emotion: "smile" },
  { who: "user", text: "I am working here since two years." },
  { who: "teacher", text: "Nice! A more natural way to say that is: “I've been working here for two years.” What do you enjoy most about it?", emotion: "encourage" },
  { who: "user", text: "I've been working here for two years and I love my team!" },
  { who: "teacher", text: "Perfect — that sounded really natural! 🎉", emotion: "impressed" },
];

/** Self-playing product demo for the landing page (no audio, no network). */
export default function HeroDemo() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<AvatarState>("speaking");
  const levelRef = useRef(0);

  useEffect(() => {
    const line = SCRIPT[step % SCRIPT.length];
    const speaking = line.who === "teacher";
    setState(speaking ? "speaking" : "listening");
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      levelRef.current = speaking ? Math.max(0, Math.sin(t * 26)) * 0.7 * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0;
      raf = requestAnimationFrame(tick);
    };
    tick();
    const dur = Math.max(2200, line.text.length * 55);
    const timer = setTimeout(() => setStep((s) => (s + 1) % SCRIPT.length), dur);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [step]);

  const visible = SCRIPT.slice(0, (step % SCRIPT.length) + 1).slice(-3);
  const current = SCRIPT[step % SCRIPT.length];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line shadow-2xl" style={{ background: "radial-gradient(90% 70% at 20% 20%, #6b4a32 0%, transparent 60%), radial-gradient(80% 60% at 85% 30%, #a0784f55 0%, transparent 60%), linear-gradient(180deg, #2b2019, #15100c)" }}>
      <div className="flex items-center justify-between p-3 text-xs">
        <span className="chip bg-ink/50">📍 Modern café</span>
        <span className="chip bg-ink/50">🤖 AI teacher</span>
      </div>
      <TeacherAvatar state={state} emotion={current.emotion ?? "listen"} levelRef={levelRef} className="mx-auto h-72 w-full md:h-80" />
      <div className="space-y-2 bg-ink/80 p-4 backdrop-blur" aria-hidden>
        {visible.map((l, i) => (
          <div key={`${step}-${i}`} className={`rise max-w-[88%] rounded-2xl px-3.5 py-2 text-sm ${l.who === "user" ? "ml-auto bg-brand/20" : "bg-panel-2"}`}>
            {l.who === "user" && <span className="mr-1 text-xs">🎙</span>}
            {l.text}
          </div>
        ))}
        <div className="flex justify-center pt-2">
          <span className={`grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-ink ${current.who === "user" ? "mic-live" : ""}`}>🎙️</span>
        </div>
      </div>
    </div>
  );
}
