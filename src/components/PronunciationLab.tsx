"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TeacherAvatar, { type AvatarState } from "./TeacherAvatar";
import UpgradeSheet, { type UpgradeInfo } from "./UpgradeSheet";
import type { Drill } from "@/lib/config/pronunciation";
import type { PronunciationResult } from "@/lib/learning/pronunciation";
import { listen, recognitionLocale, speak, speechRecognitionSupported, stopSpeaking } from "@/lib/voice/client";

interface Props {
  units: { id: string; title: string; description: string }[];
  drills: (Drill & { locked: boolean })[];
  nativeLanguage: string;
  voiceSpeed: number;
}

type Step = "listen" | "repeat" | "feedback";

export default function PronunciationLab({ units, drills, nativeLanguage, voiceSpeed }: Props) {
  const [unit, setUnit] = useState(units[0].id);
  const list = useMemo(() => drills.filter((d) => d.unit === unit), [drills, unit]);
  const [idx, setIdx] = useState(0);
  const drill = list[Math.min(idx, list.length - 1)];
  const [step, setStep] = useState<Step>("listen");
  const [state, setState] = useState<AvatarState>("idle");
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState<(PronunciationResult & { xp: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeInfo | null>(null);
  const [srOk, setSrOk] = useState(true);
  const [slow, setSlow] = useState(false);
  const levelRef = useRef(0);
  const shapeRef = useRef(0);

  useEffect(() => setSrOk(speechRecognitionSupported()), []);
  useEffect(() => {
    setStep("listen");
    setResult(null);
    setHeard("");
  }, [drill?.id]);
  useEffect(() => () => stopSpeaking(), []);

  async function model() {
    setState("speaking");
    await speak(drill.text, { rate: slow ? 0.75 : voiceSpeed, onLevel: (l, r) => { levelRef.current = l; shapeRef.current = r; } });
    setState("idle");
    setStep("repeat");
  }

  async function record() {
    setError(null);
    stopSpeaking();
    try {
      const l = listen(recognitionLocale(nativeLanguage), setHeard);
      setState("listening");
      const r = await l.done;
      setState("thinking");
      const res = await fetch("/api/pronunciation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ drillId: drill.id, heard: r.transcript, confidence: r.confidence, seconds: r.seconds }) });
      const data = await res.json();
      setState("idle");
      if (res.status === 402) return setUpgrade(data.upgrade);
      if (!res.ok) return setError(data.error);
      setResult(data);
      setStep("feedback");
    } catch (e) {
      setState("idle");
      setError((e as Error).message);
    }
  }

  const scoreColor = (s: number) => (s >= 80 ? "text-good" : s >= 55 ? "text-warn" : "text-bad");

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav aria-label="Pronunciation units" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {units.map((u) => (
          <button key={u.id} onClick={() => { setUnit(u.id); setIdx(0); }} className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${unit === u.id ? "border-brand/60 bg-panel-2" : "border-line hover:bg-panel"}`}>
            <span className="block text-sm font-semibold">{u.title}</span>
            <span className="hidden text-xs text-muted lg:block">{u.description}</span>
          </button>
        ))}
      </nav>

      {drill && (
        <section className="card overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[220px_1fr]">
            <div className="bg-[radial-gradient(120%_90%_at_50%_10%,#2a3b55_0%,#121a28_70%)] p-2">
              <TeacherAvatar state={state} emotion={result ? (result.score >= 80 ? "impressed" : result.score >= 55 ? "smile" : "encourage") : "smile"} levelRef={levelRef} shapeRef={shapeRef} className="mx-auto h-56 w-full" />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-xs">
                <span className="chip">{drill.focus}</span>
                <span className="text-muted">{idx + 1} / {list.length}</span>
                {drill.locked && <span className="chip !text-[10px]">PREMIUM</span>}
              </div>
              <p className="mt-4 font-display text-2xl leading-snug md:text-3xl">
                {result
                  ? result.words.map((w, i) => (
                      <span key={i} className={w.status === "good" ? "text-good" : w.status === "close" ? "text-warn underline decoration-dotted" : "text-bad underline"} title={w.heard ? `heard: ${w.heard}` : "not heard"}>
                        {w.target}{" "}
                      </span>
                    ))
                  : drill.text}
              </p>
              {drill.stress && <p className="mt-2 text-sm text-accent">Stress: {drill.stress}</p>}
              <p className="mt-2 text-sm text-muted">💡 {drill.tip}</p>

              <ol className="mt-6 flex items-center gap-2 text-xs text-muted" aria-label="Steps">
                {(["listen", "repeat", "feedback"] as Step[]).map((s, i) => (
                  <li key={s} className={`flex items-center gap-2 ${step === s ? "text-text" : ""}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full ${step === s ? "bg-brand text-ink" : "bg-panel-2"}`}>{i + 1}</span>
                    {s === "listen" ? "Listen" : s === "repeat" ? "Repeat" : "Feedback"}
                    {i < 2 && <span aria-hidden>→</span>}
                  </li>
                ))}
              </ol>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button className="btn btn-ghost" onClick={model} disabled={state === "listening"}>🔊 Listen</button>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> slow
                </label>
                {srOk ? (
                  <button className={`btn btn-primary ${state === "listening" ? "mic-live" : ""}`} onClick={record} disabled={state === "listening" || state === "thinking"}>
                    {state === "listening" ? "● Listening…" : state === "thinking" ? "Analysing…" : "🎙️ Repeat"}
                  </button>
                ) : (
                  <span className="text-sm text-muted">Speech recognition needs Chrome, Edge or Safari.</span>
                )}
              </div>
              {state === "listening" && heard && <p className="mt-3 text-sm italic text-muted">“{heard}”</p>}
              {error && <p className="mt-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm" role="alert">{error}</p>}

              {result && (
                <div className="rise mt-6 flex flex-wrap items-center gap-5 rounded-2xl bg-panel-2 p-4">
                  <div className="text-center">
                    <div className={`text-4xl font-semibold ${scoreColor(result.score)}`}>{result.score}</div>
                    <div className="text-xs text-muted">score · +{result.xp} XP</div>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p>{result.score >= 80 ? "Excellent — that was clear and natural!" : result.score >= 55 ? "Good! A couple of words to polish." : "Nice try — listen once more, then say it slowly."}</p>
                    {result.tips.map((t) => (
                      <p key={t} className="mt-1 text-muted">• {t}</p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => { setResult(null); setStep("repeat"); }}>↻ Again</button>
                    <button className="btn btn-primary" onClick={() => setIdx((i) => (i + 1) % list.length)}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {upgrade && <UpgradeSheet info={upgrade} onClose={() => setUpgrade(null)} source="pronunciation" />}
    </div>
  );
}
