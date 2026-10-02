"use client";

/**
 * Browser-side voice pipeline.
 *
 *   speak():  premium neural TTS via /api/tts when configured, otherwise the
 *             best available on-device female English voice. Both paths drive
 *             the avatar's mouth through `level` callbacks.
 *   listen(): Web Speech API recognition with interim captions, returning the
 *             transcript, recogniser confidence and speaking duration.
 */

export interface SpeakOptions {
  rate: number; // 0.75 | 1 | 1.25 | 1.5
  style?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onLevel?: (level: number, round: number) => void;
  onWord?: (charIndex: number) => void;
}

let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let cancelled = false;

export function stopSpeaking() {
  cancelled = true;
  currentAudio?.pause();
  currentAudio = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

const PREFERRED_VOICES = [
  /Microsoft (Aria|Jenny|Ava|Emma|Sonia|Libby|Natasha).*Natural/i,
  /Google UK English Female/i,
  /Google US English/i,
  /Samantha|Ava|Allison|Susan|Karen|Moira|Tessa|Serena|Fiona/i,
  /female/i,
];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const re of PREFERRED_VOICES) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices[0];
}

export function voicesReady(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((r) => {
    window.speechSynthesis.onvoiceschanged = () => r();
    setTimeout(r, 800);
  });
}

const ROUND = /[ouwq]/i;

export async function speak(text: string, opts: SpeakOptions): Promise<void> {
  cancelled = false;
  stopSpeaking();
  cancelled = false;
  if (await speakNeural(text, opts)) return;
  if (cancelled) return;
  await speakBrowser(text, opts);
}

async function speakNeural(text: string, opts: SpeakOptions): Promise<boolean> {
  try {
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, speed: opts.rate, style: opts.style }) });
    if (res.status !== 200 || cancelled) return false;
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.playbackRate = Math.min(1.5, Math.max(0.75, opts.rate / Math.min(1.2, opts.rate)));
    currentAudio = audio;
    audioCtx ??= new AudioContext();
    const src = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      // speech energy sits roughly in 150-3000 Hz
      let sum = 0;
      let low = 0;
      for (let i = 2; i < 70; i++) {
        sum += buf[i];
        if (i < 14) low += buf[i];
      }
      const level = Math.min(1, sum / (68 * 150));
      opts.onLevel?.(level, Math.min(1, low / Math.max(1, sum) * 2.2 - 0.3));
      raf = requestAnimationFrame(tick);
    };
    await new Promise<void>((resolve) => {
      audio.onplay = () => {
        opts.onStart?.();
        tick();
      };
      audio.onended = audio.onerror = audio.onpause = () => {
        cancelAnimationFrame(raf);
        opts.onLevel?.(0, 0);
        opts.onEnd?.();
        resolve();
      };
      audio.play().catch(() => resolve());
    });
    return true;
  } catch {
    return false;
  }
}

function speakBrowser(text: string, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      opts.onEnd?.();
      return resolve();
    }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    u.rate = opts.rate * (opts.style === "clear" ? 0.92 : 1);
    u.pitch = opts.style === "energetic" ? 1.12 : 1.04;

    // Speech synthesis gives word boundaries but no audio stream: synthesise a
    // syllable-rate mouth signal and re-sync it on every word boundary.
    let raf = 0;
    let wordStart = performance.now();
    let word = "";
    const syllableHz = 4.2 * opts.rate;
    const tick = () => {
      const t = (performance.now() - wordStart) / 1000;
      const env = Math.max(0, Math.sin(t * Math.PI * 2 * syllableHz)) * 0.75 + 0.15;
      const decay = Math.max(0.25, 1 - t * 0.6);
      opts.onLevel?.(env * decay, ROUND.test(word) ? 0.7 : 0.1);
      raf = requestAnimationFrame(tick);
    };
    u.onstart = () => {
      opts.onStart?.();
      wordStart = performance.now();
      tick();
    };
    u.onboundary = (e) => {
      wordStart = performance.now();
      word = text.slice(e.charIndex, e.charIndex + (e.charLength || 6));
      opts.onWord?.(e.charIndex);
    };
    const done = () => {
      cancelAnimationFrame(raf);
      opts.onLevel?.(0, 0);
      opts.onEnd?.();
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

// ---------------------------------------------------------------- recognition

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function speechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
}

/** English accent hint for the recogniser, based on the learner's native language. */
export function recognitionLocale(nativeLanguage: string): string {
  if (["hi", "bn", "ta", "te", "mr", "gu", "pa", "ur"].includes(nativeLanguage)) return "en-IN";
  return "en-US";
}

export interface ListenResult {
  transcript: string;
  confidence: number;
  seconds: number;
}

export interface Listener {
  stop(): void;
  abort(): void;
  done: Promise<ListenResult>;
}

export function listen(lang: string, onInterim: (text: string) => void): Listener {
  const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) throw new Error("Speech recognition is not supported in this browser. Try Chrome, Edge or Safari — or switch to Type mode.");
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  const started = performance.now();
  let lastSpeech = started;
  let firstSpeech = 0;
  const finals: { text: string; conf: number }[] = [];
  let interim = "";
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const done = new Promise<ListenResult>((resolve, reject) => {
    rec.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals.push({ text: r[0].transcript, conf: r[0].confidence });
        else interim += r[0].transcript;
      }
      if (!firstSpeech) firstSpeech = performance.now();
      lastSpeech = performance.now();
      onInterim([...finals.map((f) => f.text), interim].join(" ").replace(/\s+/g, " ").trim());
      // auto-stop after 2.2s of silence once the learner has said something
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => rec.stop(), 2200);
    };
    rec.onerror = (e) => {
      clearTimeout(silenceTimer);
      if (e.error === "no-speech" || e.error === "aborted") return;
      reject(new Error(e.error === "not-allowed" ? "Microphone permission was denied. You can allow it in your browser settings, or switch to Type mode." : `Speech recognition error: ${e.error}`));
    };
    rec.onend = () => {
      clearTimeout(silenceTimer);
      const transcript = [...finals.map((f) => f.text), interim].join(" ").replace(/\s+/g, " ").trim();
      const confs = finals.map((f) => f.conf).filter((c) => c > 0);
      const confidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : interim ? 0.6 : 0;
      const seconds = firstSpeech ? Math.max(1, (lastSpeech - firstSpeech) / 1000 + 0.6) : 0;
      resolve({ transcript, confidence, seconds });
    };
  });
  rec.start();
  return { stop: () => rec.stop(), abort: () => rec.abort(), done };
}
