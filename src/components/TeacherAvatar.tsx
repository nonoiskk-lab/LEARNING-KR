"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { Emotion } from "@/lib/ai/schema";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Built-in "portrait" avatar renderer: a layered SVG portrait animated at 60fps
 * without React re-renders. Lip-sync is driven by `levelRef` (0..1 mouth
 * openness, fed from audio amplitude or speech-synthesis word boundaries) and
 * `shapeRef` (0 = wide vowels, 1 = rounded "o/u/w" sounds).
 *
 * The same props contract is used by the streaming video-avatar adapter
 * (docs/ARCHITECTURE.md §6), so a photoreal vendor avatar can replace this
 * component without touching the session UI.
 */
export interface TeacherAvatarProps {
  state: AvatarState;
  emotion: Emotion;
  levelRef: MutableRefObject<number>;
  shapeRef?: MutableRefObject<number>;
  className?: string;
}

const EXPRESSIONS: Record<Emotion, { smile: number; brow: number; browTilt: number; eyeOpen: number; cheek: number; tilt: number }> = {
  neutral: { smile: 0.25, brow: 0, browTilt: 0, eyeOpen: 1, cheek: 0.15, tilt: 0 },
  listen: { smile: 0.3, brow: -1.5, browTilt: 0, eyeOpen: 1.04, cheek: 0.2, tilt: 2.5 },
  smile: { smile: 0.75, brow: -2, browTilt: 0, eyeOpen: 0.88, cheek: 0.55, tilt: 1.5 },
  encourage: { smile: 0.6, brow: -3.5, browTilt: 2, eyeOpen: 0.95, cheek: 0.4, tilt: -2.5 },
  laugh: { smile: 1, brow: -3, browTilt: 0, eyeOpen: 0.62, cheek: 0.8, tilt: 3 },
  think: { smile: 0.15, brow: -4, browTilt: -3, eyeOpen: 0.92, cheek: 0.1, tilt: -3 },
  impressed: { smile: 0.85, brow: -5.5, browTilt: 0, eyeOpen: 1.08, cheek: 0.6, tilt: 0 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function TeacherAvatar({ state, emotion, levelRef, shapeRef, className }: TeacherAvatarProps) {
  const root = useRef<SVGSVGElement>(null);
  const live = useRef({ state, emotion });
  live.current = { state, emotion };

  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const q = <T extends Element>(id: string) => svg.querySelector<T>(`[data-part="${id}"]`)!;
    const head = q<SVGGElement>("head");
    const body = q<SVGGElement>("body");
    const lidL = q<SVGPathElement>("lidL");
    const lidR = q<SVGPathElement>("lidR");
    const irisL = q<SVGGElement>("irisL");
    const irisR = q<SVGGElement>("irisR");
    const browL = q<SVGPathElement>("browL");
    const browR = q<SVGPathElement>("browR");
    const upper = q<SVGPathElement>("lipU");
    const lower = q<SVGPathElement>("lipL");
    const inner = q<SVGPathElement>("mouthIn");
    const teeth = q<SVGPathElement>("teeth");
    const cheeks = q<SVGGElement>("cheeks");
    const hand = q<SVGGElement>("hand");

    const cur = { ...EXPRESSIONS.neutral, open: 0, round: 0, gazeX: 0, gazeY: 0, nod: 0, hand: 0 };
    let nextBlink = performance.now() + 1500 + Math.random() * 2500;
    let blinkT = -1;
    let nextSaccade = performance.now() + 800;
    let gazeTarget = { x: 0, y: 0 };
    let handTarget = 0;
    let nextGesture = performance.now() + 4000;
    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (now: number) => {
      const { state: st, emotion: em } = live.current;
      const target = EXPRESSIONS[em] ?? EXPRESSIONS.neutral;
      const k = 0.08;
      cur.smile = lerp(cur.smile, target.smile, k);
      cur.brow = lerp(cur.brow, target.brow + (st === "listening" ? -1.2 : 0), k);
      cur.browTilt = lerp(cur.browTilt, target.browTilt, k);
      cur.eyeOpen = lerp(cur.eyeOpen, target.eyeOpen, k);
      cur.cheek = lerp(cur.cheek, target.cheek, k);
      cur.tilt = lerp(cur.tilt, target.tilt + (st === "thinking" ? -2 : 0), 0.04);

      // lip-sync
      const level = st === "speaking" ? Math.min(1, Math.max(0, levelRef.current)) : 0;
      cur.open = lerp(cur.open, level, level > cur.open ? 0.45 : 0.25);
      cur.round = lerp(cur.round, shapeRef?.current ?? 0, 0.3);

      // natural blinking (occasional double blink)
      if (blinkT < 0 && now > nextBlink) blinkT = now;
      let blink = 0;
      if (blinkT >= 0) {
        const p = (now - blinkT) / 140;
        blink = p < 1 ? Math.sin(p * Math.PI) : 0;
        if (p >= 1) {
          blinkT = -1;
          nextBlink = now + (Math.random() < 0.15 ? 180 : 2200 + Math.random() * 3800);
        }
      }

      // eye saccades; look up-left while thinking, at the learner while listening
      if (now > nextSaccade) {
        gazeTarget = st === "thinking" ? { x: -3, y: -3 } : st === "listening" ? { x: (Math.random() - 0.5) * 1.2, y: 0 } : { x: (Math.random() - 0.5) * 3.5, y: (Math.random() - 0.5) * 1.8 };
        nextSaccade = now + 600 + Math.random() * 2200;
      }
      cur.gazeX = lerp(cur.gazeX, gazeTarget.x, 0.35);
      cur.gazeY = lerp(cur.gazeY, gazeTarget.y, 0.35);

      // subtle hand gesture while speaking or encouraging
      if (now > nextGesture) {
        handTarget = st === "speaking" || em === "encourage" || em === "impressed" ? (handTarget > 0 ? 0 : 1) : 0;
        nextGesture = now + 1800 + Math.random() * 3000;
      }
      cur.hand = lerp(cur.hand, handTarget, 0.05);

      const t = now / 1000;
      const breathe = reduce ? 0 : Math.sin(t * 1.6) * 0.006;
      const sway = reduce ? 0 : Math.sin(t * 0.7) * 1.2 + Math.sin(t * 1.9) * 0.4;
      cur.nod = lerp(cur.nod, st === "speaking" ? Math.sin(t * 5.2) * level * 1.6 : st === "listening" ? Math.sin(t * 2.2) * 0.6 : 0, 0.15);

      body.setAttribute("transform", `translate(200 470) scale(${1 + breathe} ${1 + breathe * 1.4}) translate(-200 -470)`);
      head.setAttribute("transform", `rotate(${cur.tilt + sway * 0.6} 200 300) translate(${sway * 0.4} ${cur.nod + breathe * -60})`);

      // eyes
      const open = Math.max(0, cur.eyeOpen * (1 - blink));
      const lid = (cx: number) => {
        const top = 196 - 9 * open;
        return `M${cx - 17} 197 Q${cx} ${top - 8 * open} ${cx + 17} 197 L${cx + 19} 178 L${cx - 19} 178 Z`;
      };
      lidL.setAttribute("d", lid(162));
      lidR.setAttribute("d", lid(238));
      irisL.setAttribute("transform", `translate(${cur.gazeX} ${cur.gazeY})`);
      irisR.setAttribute("transform", `translate(${cur.gazeX} ${cur.gazeY})`);

      // brows
      const by = 172 + cur.brow;
      browL.setAttribute("d", `M140 ${by + 4 - cur.browTilt} Q160 ${by - 6} 183 ${by + cur.browTilt * 0.5}`);
      browR.setAttribute("d", `M217 ${by + cur.browTilt * 0.5} Q240 ${by - 6} 260 ${by + 4 - cur.browTilt}`);

      // mouth
      const w = 27 * (1 - cur.round * 0.35) * (1 + cur.smile * 0.08);
      const cy = 262;
      const corner = cy - cur.smile * 6;
      const o = cur.open * 15;
      const left = 200 - w;
      const right = 200 + w;
      upper.setAttribute("d", `M${left} ${corner} Q${200 - w * 0.5} ${cy - 7 - o * 0.25} 200 ${cy - 4 - o * 0.2} Q${200 + w * 0.5} ${cy - 7 - o * 0.25} ${right} ${corner} Q200 ${cy + 1 - o * 0.15 - cur.smile * 2} ${left} ${corner} Z`);
      lower.setAttribute("d", `M${left + 2} ${corner + 1} Q200 ${cy + 3 + o - cur.smile * 1} ${right - 2} ${corner + 1} Q200 ${cy + 13 + o * 1.1} ${left + 2} ${corner + 1} Z`);
      inner.setAttribute("d", `M${left + 3} ${corner + 0.5} Q200 ${cy - o * 0.15 - cur.smile * 2} ${right - 3} ${corner + 0.5} Q200 ${cy + 3 + o} ${left + 3} ${corner + 0.5} Z`);
      inner.setAttribute("opacity", String(Math.min(1, cur.open * 3 + (cur.smile > 0.8 ? 0.6 : 0))));
      teeth.setAttribute("d", `M${left + 8} ${corner + 0.5} Q200 ${cy - o * 0.15 - cur.smile * 2} ${right - 8} ${corner + 0.5} L${right - 10} ${corner + 2 + o * 0.25} Q200 ${cy + o * 0.3} ${left + 10} ${corner + 2 + o * 0.25} Z`);
      teeth.setAttribute("opacity", String(Math.min(0.95, cur.open * 2.5 + (cur.smile > 0.7 ? 0.5 : 0))));
      cheeks.setAttribute("opacity", String(cur.cheek * 0.55));
      hand.setAttribute("transform", `translate(0 ${60 - cur.hand * 60}) rotate(${-8 + cur.hand * 8} 300 470)`);
      hand.setAttribute("opacity", String(cur.hand));

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, shapeRef]);

  return (
    <svg ref={root} viewBox="0 0 400 480" className={className} role="img" aria-label={`Maya, your AI English teacher, is ${state}`}>
      <defs>
        <radialGradient id="skin" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#e7b896" />
          <stop offset="60%" stopColor="#d49f7b" />
          <stop offset="100%" stopColor="#b98262" />
        </radialGradient>
        <linearGradient id="neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b98262" />
          <stop offset="100%" stopColor="#cf9a77" />
        </linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a2418" />
          <stop offset="55%" stopColor="#24150e" />
          <stop offset="100%" stopColor="#140b07" />
        </linearGradient>
        <linearGradient id="hairShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7a4e33" stopOpacity="0" />
          <stop offset="50%" stopColor="#8a5a3b" stopOpacity=".55" />
          <stop offset="100%" stopColor="#7a4e33" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="blazer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f4a63" />
          <stop offset="100%" stopColor="#1c2e40" />
        </linearGradient>
        <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b5615c" />
          <stop offset="100%" stopColor="#9a4a47" />
        </linearGradient>
        <radialGradient id="iris" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7b5232" />
          <stop offset="70%" stopColor="#4a2e1a" />
          <stop offset="100%" stopColor="#2b190d" />
        </radialGradient>
        <radialGradient id="rim" cx="50%" cy="35%" r="70%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".35" />
        </radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <g data-part="body">
        {/* hair behind shoulders */}
        <path d="M108 190 C 92 300, 110 380, 120 430 L 280 430 C 292 380, 308 300, 292 190 Z" fill="url(#hair)" />
        {/* shoulders, blazer and blouse */}
        <path d="M70 480 C 78 410, 128 380, 168 368 L 232 368 C 272 380, 322 410, 330 480 Z" fill="url(#blazer)" />
        <path d="M168 368 L 200 440 L 232 368 L 222 364 L 200 410 L 178 364 Z" fill="#f2ede6" />
        <path d="M168 368 L 150 380 L 186 470 L 200 440 Z M232 368 L 250 380 L 214 470 L 200 440 Z" fill="#253d54" />
        <path d="M181 270 L 182 368 Q 200 392 218 368 L 219 270 Z" fill="url(#neck)" />
        <path d="M184 336 Q 200 350 216 336 L 216 346 Q 200 360 184 346 Z" fill="#a8715a" opacity=".45" />
        <circle cx="200" cy="384" r="3.2" fill="#e8d7b4" />
        {/* gesture hand */}
        <g data-part="hand" opacity="0">
          <path d="M282 480 C 284 452, 292 430, 304 418 C 310 412, 318 414, 318 422 L 314 444 C 326 430, 336 432, 334 444 C 332 456, 322 470, 318 480 Z" fill="url(#skin)" />
          <path d="M276 480 L 330 480 L 326 470 L 280 470 Z" fill="#1c2e40" />
        </g>

        <g data-part="head">
          {/* back hair volume */}
          <path d="M118 175 C 112 92, 168 58, 205 60 C 258 62, 296 102, 290 182 C 288 230, 282 280, 276 310 L 124 310 C 118 270, 116 220, 118 175 Z" fill="url(#hair)" />
          {/* ears */}
          <ellipse cx="128" cy="214" rx="10" ry="18" fill="#c98f6c" />
          <ellipse cx="272" cy="214" rx="10" ry="18" fill="#c98f6c" />
          <circle cx="128" cy="236" r="3" fill="#e8d7b4" />
          <circle cx="272" cy="236" r="3" fill="#e8d7b4" />
          {/* face */}
          <path d="M132 186 C 132 128, 166 104, 200 104 C 236 104, 268 128, 268 186 C 268 246, 246 296, 200 312 C 154 296, 132 246, 132 186 Z" fill="url(#skin)" />
          <path d="M132 186 C 132 128, 166 104, 200 104 C 236 104, 268 128, 268 186 C 268 246, 246 296, 200 312 C 154 296, 132 246, 132 186 Z" fill="url(#rim)" />
          <g data-part="cheeks" opacity=".1" filter="url(#soft)">
            <ellipse cx="156" cy="238" rx="17" ry="10" fill="#e07a6f" />
            <ellipse cx="244" cy="238" rx="17" ry="10" fill="#e07a6f" />
          </g>
          {/* nose */}
          <path d="M197 200 Q 193 228 186 238 Q 192 246 200 244 Q 208 246 214 238 Q 207 228 203 200" fill="none" stroke="#a46f53" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
          <path d="M188 240 Q 200 248 212 240" fill="none" stroke="#8d5a42" strokeWidth="2" strokeLinecap="round" opacity=".5" />
          {/* eyes */}
          {[162, 238].map((cx, i) => (
            <g key={cx}>
              <path d={`M${cx - 17} 197 Q${cx} 183 ${cx + 17} 197 Q${cx} 205 ${cx - 17} 197 Z`} fill="#f7f2ee" />
              <g data-part={i === 0 ? "irisL" : "irisR"}>
                <circle cx={cx} cy="195" r="7.4" fill="url(#iris)" />
                <circle cx={cx} cy="195" r="3.3" fill="#120a05" />
                <circle cx={cx + 2.4} cy="192.4" r="1.7" fill="#fff" opacity=".9" />
              </g>
              <path data-part={i === 0 ? "lidL" : "lidR"} d="" fill="#c99272" />
              <path d={`M${cx - 18} 197 Q${cx} 181 ${cx + 18} 197`} fill="none" stroke="#2a170d" strokeWidth="2.4" strokeLinecap="round" />
              <path d={`M${cx - 15} 203 Q${cx} 207 ${cx + 15} 203`} fill="none" stroke="#a46f53" strokeWidth="1" opacity=".5" />
            </g>
          ))}
          {/* brows */}
          <path data-part="browL" d="" fill="none" stroke="#2a170d" strokeWidth="4.2" strokeLinecap="round" />
          <path data-part="browR" d="" fill="none" stroke="#2a170d" strokeWidth="4.2" strokeLinecap="round" />
          {/* mouth */}
          <path data-part="mouthIn" d="" fill="#4a1f1f" opacity="0" />
          <path data-part="teeth" d="" fill="#f4efe9" opacity="0" />
          <path data-part="lipU" d="" fill="url(#lip)" />
          <path data-part="lipL" d="" fill="url(#lip)" />
          {/* front hair: side part with soft waves */}
          <path d="M130 186 C 122 120, 160 84, 214 86 C 248 88, 276 112, 272 160 C 258 128, 232 112, 204 116 C 186 136, 156 150, 136 196 Z" fill="url(#hair)" />
          <path d="M150 120 C 176 96, 228 92, 258 118" fill="none" stroke="url(#hairShine)" strokeWidth="6" strokeLinecap="round" />
          <path d="M268 160 C 284 210, 282 260, 270 300 C 284 262, 290 214, 276 150 Z" fill="url(#hair)" />
          <path d="M134 194 C 120 236, 122 270, 132 304 C 116 270, 114 230, 126 180 Z" fill="url(#hair)" />
        </g>
      </g>
    </svg>
  );
}
