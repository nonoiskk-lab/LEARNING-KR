"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import TeacherAvatar, { type AvatarState } from "./TeacherAvatar";
import CorrectionCard from "./CorrectionCard";
import UpgradeSheet, { type UpgradeInfo } from "./UpgradeSheet";
import type { Correction, Emotion, TeacherTurn } from "@/lib/ai/schema";
import { listen, recognitionLocale, speak, speechRecognitionSupported, stopSpeaking, voicesReady, type Listener } from "@/lib/voice/client";

interface Msg {
  id: string;
  role: "user" | "teacher";
  text: string;
  inputMode?: "speak" | "type";
  corrections?: Correction[];
  bridge?: TeacherTurn["nativeBridge"];
  vocab?: TeacherTurn["newVocabulary"];
}

interface Props {
  mode: string;
  scenarioId?: string;
  title: string;
  subtitle?: string;
  sceneBackground: string;
  sceneName: string;
  prefs: { nativeLanguage: string; voiceSpeed: number; voiceStyle: string; voiceConsent: boolean };
  aiMode: "claude" | "gemini" | "demo";
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function SessionClient(p: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [state, setState] = useState<AvatarState>("idle");
  const [emotion, setEmotion] = useState<Emotion>("smile");
  const [inputMode, setInputMode] = useState<"speak" | "type">("type");
  const [srOk, setSrOk] = useState(false);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [caption, setCaption] = useState("");
  const [showCaptions, setShowCaptions] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speed, setSpeed] = useState(p.prefs.voiceSpeed || 1);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeInfo | null>(null);
  const [consentNeeded, setConsentNeeded] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [summary, setSummary] = useState<null | { turns: number; words: number; speakingSeconds: number; bonusXp: number; topCorrections: Correction[] }>(null);
  const [xpSession, setXpSession] = useState(0);

  const levelRef = useRef(0);
  const shapeRef = useRef(0);
  const listener = useRef<Listener | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const consent = useRef(p.prefs.voiceConsent);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  useEffect(() => {
    // feature-detect after hydration to keep server and client markup identical
    const ok = speechRecognitionSupported();
    setSrOk(ok);
    if (ok) setInputMode("speak");
  }, []);

  useEffect(() => () => {
    stopSpeaking();
    listener.current?.abort();
  }, []);

  const say = useCallback(
    async (text: string, emo: Emotion = "smile") => {
      setEmotion(emo);
      setCaption(text);
      if (!voiceOn) {
        setState("idle");
        return;
      }
      setState("speaking");
      await speak(text, {
        rate: speed,
        style: p.prefs.voiceStyle,
        onLevel: (l, r) => {
          levelRef.current = l;
          shapeRef.current = r;
        },
      });
      setState((s) => (s === "speaking" ? "idle" : s));
      setEmotion((e) => (e === "laugh" ? "smile" : e));
    },
    [voiceOn, speed, p.prefs.voiceStyle],
  );

  async function begin() {
    setStarted(true);
    setState("thinking");
    await voicesReady();
    const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: p.mode, scenarioId: p.scenarioId }) });
    const data = await res.json();
    if (res.status === 402) {
      setState("idle");
      setUpgrade(data.upgrade);
      return;
    }
    if (!res.ok) {
      setState("idle");
      setError(data.error ?? "Could not start the session");
      return;
    }
    setSessionId(data.sessionId);
    setMessages([{ id: data.opener.id, role: "teacher", text: data.opener.text }]);
    await say(data.opener.text, "smile");
  }

  async function send(text: string, mode: "speak" | "type", meta?: { confidence?: number; seconds?: number }) {
    if (!sessionId || !text.trim()) return;
    stopSpeaking();
    setError(null);
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text: text.trim(), inputMode: mode };
    setMessages((m) => [...m, userMsg]);
    setState("thinking");
    setEmotion("listen");
    const res = await fetch(`/api/session/${sessionId}/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, inputMode: mode, sttConfidence: meta?.confidence, speakingSeconds: meta?.seconds }),
    });
    const data = await res.json();
    if (res.status === 402) {
      setState("idle");
      setEmotion("smile");
      setUpgrade(data.upgrade);
      return;
    }
    if (!res.ok) {
      setState("idle");
      setError(data.error ?? "Something went wrong — please try again.");
      return;
    }
    const t: TeacherTurn = data.teacher;
    setMessages((m) => [...m, { id: data.messageId, role: "teacher", text: t.reply, corrections: t.corrections, bridge: t.nativeBridge, vocab: t.newVocabulary }]);
    setXpSession((x) => x + data.xpGained);
    toast(`+${data.xpGained} XP`);
    for (const a of data.achievements ?? []) toast(`${a.icon} Achievement unlocked: ${a.title}`);
    if (data.levelUp) toast(`🎉 You reached ${data.levelUp}!`);
    if (data.remainingTurns === 3) toast("3 free replies left today");
    await say(t.reply, t.emotion);
  }

  async function ensureConsent(): Promise<boolean> {
    if (consent.current) return true;
    setConsentNeeded(true);
    return false;
  }

  async function grantConsent() {
    consent.current = true;
    setConsentNeeded(false);
    await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceConsent: true }) });
    void toggleMic();
  }

  async function toggleMic() {
    if (state === "listening") {
      listener.current?.stop();
      return;
    }
    if (!(await ensureConsent())) return;
    // barge-in: the learner can interrupt the teacher at any time
    stopSpeaking();
    levelRef.current = 0;
    setError(null);
    try {
      const l = listen(recognitionLocale(p.prefs.nativeLanguage), (t) => setInterim(t));
      listener.current = l;
      setState("listening");
      setEmotion("listen");
      const r = await l.done;
      listener.current = null;
      setInterim("");
      if (!r.transcript) {
        setState("idle");
        setEmotion("encourage");
        setError("I didn't catch that — tap the mic and try again, a little closer to the microphone.");
        return;
      }
      await send(r.transcript, "speak", { confidence: r.confidence, seconds: r.seconds });
    } catch (e) {
      setState("idle");
      setInterim("");
      setError((e as Error).message);
      if ((e as Error).message.includes("denied")) {
        setInputMode("type");
        fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "mic_denied" }) }).catch(() => {});
      }
    }
  }

  async function finish() {
    stopSpeaking();
    listener.current?.abort();
    if (!sessionId) return;
    const res = await fetch(`/api/session/${sessionId}/end`, { method: "POST" });
    const data = await res.json();
    if (data.summary) setSummary(data.summary);
    router.refresh();
  }

  function practice(text: string) {
    void say(`Try saying: ${text}`, "encourage");
  }

  const lastCorrections = [...messages].reverse().find((m) => m.role === "teacher" && m.corrections?.length)?.corrections ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* STAGE */}
      <section className="relative overflow-hidden rounded-3xl border border-line" style={{ background: p.sceneBackground }} aria-label={`Scene: ${p.sceneName}`}>
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 text-xs">
          <span className="chip bg-ink/50 backdrop-blur">📍 {p.sceneName}</span>
          <span className="chip bg-ink/50 backdrop-blur" title="Maya is an AI teacher">🤖 AI teacher{p.aiMode === "demo" ? " · demo" : ""}</span>
        </div>
        <div className="relative mx-auto aspect-[4/4.2] max-h-[46dvh] w-full max-w-md lg:max-h-[62dvh]">
          <TeacherAvatar state={state} emotion={emotion} levelRef={levelRef} shapeRef={shapeRef} className="h-full w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.45)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        {showCaptions && (caption || interim) && (
          <p className="absolute inset-x-3 bottom-3 z-10 rounded-xl bg-black/65 px-4 py-2.5 text-center text-[0.95rem] leading-snug backdrop-blur" aria-live="polite">
            {state === "listening" ? <span className="text-brand-2">{interim || "Listening…"}</span> : caption}
          </p>
        )}
        <div className="absolute left-3 top-12 z-10 text-xs text-white/80" aria-live="polite">
          {state === "thinking" && <span className="chip bg-ink/60">Maya is thinking…</span>}
          {state === "listening" && <span className="chip bg-ink/60 text-brand-2">● Listening</span>}
        </div>

        {!started && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-ink via-ink/60 to-transparent p-6 text-center">
            <h1 className="font-display text-2xl">{p.title}</h1>
            {p.subtitle && <p className="max-w-sm text-sm text-muted">{p.subtitle}</p>}
            <button className="btn btn-primary mt-2 px-8 py-3.5 text-lg" onClick={begin} autoFocus>
              ▶ Start
            </button>
          </div>
        )}
      </section>

      {/* CONVERSATION */}
      <section className="flex min-h-[40dvh] flex-col rounded-3xl border border-line bg-panel/60 lg:h-[calc(62dvh+2px)]">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
          <h2 className="mr-auto min-w-0 truncate font-semibold">{p.title}</h2>
          <label className="sr-only" htmlFor="speed">Voice speed</label>
          <select id="speed" className="rounded-full border border-line bg-panel-2 px-2 py-1 text-xs" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Voice speed">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
          <button className="chip !px-2.5 !py-1 text-xs" aria-pressed={voiceOn} onClick={() => { setVoiceOn((v) => !v); stopSpeaking(); }} title="Teacher voice on/off">
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <button className="chip !px-2.5 !py-1 text-xs" aria-pressed={showCaptions} onClick={() => setShowCaptions((v) => !v)} title="Captions">
            CC
          </button>
          {sessionId && (
            <button className="chip !px-2.5 !py-1 text-xs hover:text-text" onClick={finish}>
              End
            </button>
          )}
        </header>

        <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`rise flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "rounded-br-sm bg-brand/15 text-text" : "rounded-bl-sm bg-panel-2"}`}>
                {m.role === "user" && <span className="mr-1.5 text-xs text-muted">{m.inputMode === "speak" ? "🎙" : "⌨"}</span>}
                {m.text}
                {m.role === "teacher" && voiceOn && (
                  <button className="ml-2 align-middle text-xs text-muted hover:text-text" onClick={() => say(m.text, "smile")} aria-label="Replay">
                    ↻
                  </button>
                )}
              </div>
              {m.bridge && (
                <div className="max-w-[85%] rounded-2xl border border-accent/40 bg-accent/10 p-3 text-sm">
                  <p className="label mb-1 !text-accent">Say it in English</p>
                  <p className="font-medium">{m.bridge.english}</p>
                  <p className="mt-1 text-muted">{m.bridge.tip}</p>
                </div>
              )}
              {m.corrections?.map((c, i) => (
                <div key={i} className="w-full max-w-[85%]">
                  <CorrectionCard c={c} onPractice={practice} />
                </div>
              ))}
              {!!m.vocab?.length && (
                <div className="flex max-w-[85%] flex-wrap gap-2">
                  {m.vocab.map((v) => (
                    <span key={v.word} className="chip" title={`${v.meaning} — ${v.example}`}>
                      🧠 {v.word}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {state === "listening" && interim && <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand/10 px-4 py-2.5 italic text-muted">{interim}</div>}
          {error && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm" role="alert">{error}</p>}
        </div>

        {/* CONTROLS */}
        <div className="border-t border-line p-3">
          {inputMode === "speak" ? (
            <div className="flex items-center justify-between gap-3">
              <button className="btn btn-ghost !px-4" onClick={() => setInputMode("type")} aria-label="Switch to typing">
                ⌨️ <span className="hidden sm:inline">Type</span>
              </button>
              <button
                onClick={toggleMic}
                disabled={!sessionId || state === "thinking"}
                className={`grid h-20 w-20 place-items-center rounded-full text-3xl shadow-xl transition disabled:opacity-40 ${state === "listening" ? "mic-live bg-brand text-ink" : "bg-brand text-ink hover:bg-brand-2"}`}
                aria-label={state === "listening" ? "Stop and send" : "Tap to speak"}
              >
                {state === "listening" ? "■" : "🎙️"}
              </button>
              <span className="w-[84px] text-right text-xs text-muted">{state === "listening" ? "Tap when done" : state === "speaking" ? "Tap mic to interrupt" : "Tap to speak"}</span>
            </div>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = draft;
                setDraft("");
                void send(t, "type");
              }}
            >
              {srOk && (
                <button type="button" className="btn btn-ghost !px-3" onClick={() => setInputMode("speak")} aria-label="Switch to speaking">
                  🎙️
                </button>
              )}
              <label htmlFor="msg" className="sr-only">Your message</label>
              <textarea
                id="msg"
                rows={1}
                className="input max-h-32 min-h-[48px] min-w-0 flex-1 resize-none"
                placeholder={sessionId ? "Type in English — or your language, I'll help…" : "Press Start first"}
                value={draft}
                disabled={!sessionId}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement).requestSubmit();
                  }
                }}
              />
              <button className="btn btn-primary" disabled={!sessionId || !draft.trim() || state === "thinking"}>
                Send
              </button>
            </form>
          )}
          {lastCorrections.length > 0 && <p className="mt-2 text-center text-xs text-muted">Tip: use “Say it again” on a correction, then try the sentence yourself.</p>}
        </div>
      </section>

      {/* toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="toast rounded-full border border-line bg-panel px-4 py-2 text-sm shadow-xl">{t.text}</div>
        ))}
      </div>

      {consentNeeded && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="card rise w-full max-w-md p-6">
            <h2 id="consent-title" className="font-display text-xl">Can Maya listen?</h2>
            <p className="mt-2 text-sm text-muted">
              To practise speaking, your voice is converted to text by your browser&apos;s speech service. The text of the conversation is sent to our AI provider to create Maya's replies, and we store it to track your progress — never your raw audio. You can delete your data anytime in Profile → Privacy.
            </p>
            <div className="mt-5 flex gap-3">
              <button className="btn btn-primary flex-1" onClick={grantConsent}>Allow & start speaking</button>
              <button className="btn btn-ghost" onClick={() => { setConsentNeeded(false); setInputMode("type"); }}>Type instead</button>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" role="dialog" aria-modal="true" aria-labelledby="sum-title">
          <div className="card rise w-full max-w-md p-6">
            <p className="label">Session complete</p>
            <h2 id="sum-title" className="font-display text-2xl">Great practice! 🎉</h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat n={summary.turns} label="replies" />
              <Stat n={summary.words} label="words" />
              <Stat n={xpSession + summary.bonusXp} label="XP" />
            </div>
            {summary.topCorrections.length > 0 && (
              <div className="mt-4">
                <p className="label mb-2">Remember for next time</p>
                <ul className="space-y-1.5 text-sm">
                  {summary.topCorrections.map((c, i) => (
                    <li key={i}>
                      <span className="text-muted line-through">{c.youSaid}</span> → <span className="text-good">{c.moreNatural || c.better}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Maya will bring these up again in your next sessions.</p>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Link href={p.mode === "assessment" ? "/app?welcome=1" : "/progress"} className="btn btn-primary flex-1">
                {p.mode === "assessment" ? "See my plan" : "See progress"}
              </Link>
              <Link href="/practice" className="btn btn-ghost">More practice</Link>
            </div>
          </div>
        </div>
      )}

      {upgrade && <UpgradeSheet info={upgrade} onClose={() => setUpgrade(null)} source={`session_${p.mode}`} />}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-panel-2 p-3">
      <div className="text-2xl font-semibold">{n}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
