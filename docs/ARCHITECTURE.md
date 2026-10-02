# Fluentia — Product & System Architecture

Fluentia is an AI spoken-English academy: a learner opens the app, sees Maya (an AI teacher avatar), taps the mic, speaks, gets a natural reply with gentle corrections, and visibly improves over time. This document covers the 15 build areas from the product brief and states, for each one, what is **implemented in this repo** and what is **a provider integration point**.

---

## 1. Product architecture

```
┌────────────── Client (Next.js App Router, mobile-first PWA-ready) ──────────────┐
│ Landing · Onboarding · Home · Practice/Session · Roleplay · Pronunciation Lab   │
│ Progress · Profile/Privacy · Pricing · Admin                                    │
│                                                                                 │
│  Voice engine (lib/voice/client.ts)      Avatar renderer (TeacherAvatar.tsx)    │
│   STT: Web Speech API (en-IN / en-US)     60fps SVG portrait, lip-sync from     │
│   TTS: /api/tts neural → browser voice    audio level, blink, gaze, emotions    │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ JSON over HTTPS (cookie session)
┌───────────────────────────────▼─────────────────────────────────────────────────┐
│ API routes (src/app/api/*)                                                      │
│   session · turn · end · pronunciation · tts · progress · me · auth · billing   │
│                                                                                 │
│ Services (src/lib/services)                                                     │
│   learning.ts  ← the learning loop orchestrator                                 │
│   progress.ts · admin.ts                                                        │
│                                                                                 │
│ Domain (pure, unit-tested)          AI brain                 Billing            │
│   learning/skills.ts                 ai/prompt.ts (persona)   entitlements.ts   │
│   learning/memory.ts (SRS)           ai/schema.ts (zod)       usage.ts (meter)  │
│   learning/gamification.ts           ai/teacher.ts (Claude)   stripe.ts         │
│   learning/pronunciation.ts          ai/mock.ts (offline)                       │
│   analytics/metrics.ts (BI)                                                     │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │ Prisma
                      SQLite (dev) / PostgreSQL (prod)
```

**Design principles**

- **Configuration over code.** Languages (`config/languages.ts`), plans & limits (`config/plans.ts`), learning modes & scenes (`config/modes.ts`), roleplay scenarios (`config/scenarios.ts`), pronunciation drills and achievements are data. Adding Swahili, a new scenario, or changing the free-plan limit is a one-line change.
- **Pure domain core.** Skill estimation, spaced repetition, XP/streaks, pronunciation alignment and unit economics are pure functions with tests (`tests/`). They can move to a worker or warehouse unchanged.
- **Provider-agnostic edges.** The LLM, TTS, STT and avatar are each behind one module, so vendors can be swapped by environment variable.
- **Runs with zero keys.** Without an Anthropic key the offline demo tutor (`ai/mock.ts`) handles conversations with rule-based corrections, so product, design and QA work never blocks on AI spend.

## 2. User flow

1. **Landing** → “Start Speaking Free” (no signup wall).
2. **Onboarding** (`/onboarding`): *“Hi! I'm your AI English Coach 👋”* → 🎙️ Speak / ⌨️ Type → *“What language do you normally speak?”* → *“What is your English level?”* A guest account is created silently (`getOrCreateGuest`).
3. If **“I'm not sure”** (or “Try a Conversation”) → *“Let's have a quick conversation so I can understand your English level.”* → assessment session (6 turns of gradually harder questions). Claude returns `levelEstimate`, which sets the CEFR level.
4. **Home**: today's topic, one big **START SPEAKING** button, streak/XP, retention nudges, practice modes.
5. **Session**: speak or type → reply in voice + avatar + captions → correction cards → XP/achievement toasts → end-of-session recap (“Remember for next time”).
6. **Conversion moments** appear only at natural stops (daily limit reached, locked premium mode) — never mid-sentence.
7. **Signup** converts the guest *in place*, so streak, level and mistake memory are kept.

## 3. Database architecture

Prisma schema: `prisma/schema.prisma`.

| Model | Purpose |
|---|---|
| `User` | profile, native language, CEFR level, XP, streak, voice consent, accessibility prefs, acquisition source |
| `Subscription` | plan, interval, status, Stripe ids, normalised `mrrCents`, trial/period ends, `canceledAt` |
| `SkillScore` | rolling 0–100 estimate per skill + sample count |
| `LearningSession` / `Message` | conversations, input mode, per-turn score, corrections JSON, avatar emotion |
| `MistakePattern` | **mistake memory** — one row per recurring error with SRS scheduling (`ease`, `intervalDays`, `dueAt`, `mastered`) |
| `VocabularyItem` | words introduced in context |
| `UserAchievement` | unlocked badges |
| `UsageDay` | daily metering for plan limits **and** AI cost accounting (tokens, TTS chars, STT seconds, avatar seconds, cost in micro-USD) |
| `AnalyticsEvent` | product funnel events |
| `MarketingSpend` | per-channel monthly spend for CAC |

**Production:** switch `provider = "postgresql"` and run `prisma migrate deploy`. Enums are stored as strings so the same schema runs on SQLite and Postgres. All user-owned tables cascade on user delete (right to erasure). Add a read replica + nightly export of `UsageDay`/`AnalyticsEvent` to a warehouse (BigQuery/Snowflake) once volumes grow; `analytics/metrics.ts` is written to run there unchanged.

## 4. AI conversation architecture

`src/lib/ai/teacher.ts` — one structured call per learner turn.

- **Model:** `claude-opus-5-5` by default (`TEACHER_MODEL`), effort `low` (`TEACHER_EFFORT`) to keep conversational latency down. Opus 5.5 always uses adaptive thinking; effort is the depth control.
- **Structured output:** `client.beta.messages.parse` with `betaZodOutputFormat(TeacherTurnSchema)`. Each turn returns:
  `reply` (spoken text), `corrections[≤3]` (`youSaid/better/moreNatural/why/patternKey`), `nativeBridge`, `emotion` (drives the avatar), `signals` (grammar/vocabulary/fluency/structure/confidence/complexity scores), `newVocabulary`, `usedCorrectly` (mistake-memory hits), `goalAchieved` (roleplay), `levelEstimate` (assessment).
- **Prompt caching:** the persona/rules block (`TEACHER_SYSTEM`) is identical for every learner and carries `cache_control`, so it is billed at cache-read rates. Learner context (level, native language, difficulty, focus mistakes, scenario) follows it.
- **History window:** last 16 messages verbatim; long-term context lives in skills and mistake memory instead of an ever-growing transcript.
- **Safety & robustness:** server-side refusal fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); if the final `stop_reason` is still `refusal` or output can't be parsed, the conversation continues gracefully. Maya always discloses she is an AI.
- **Correction policy (in the prompt):** react to content first; at most one correction spoken, ≤3 recorded; ignore STT noise; always end with exactly one question; never feel like an exam.

## 5. Voice pipeline

```
Mic → Web Speech API (interim captions, 2.2s silence auto-stop, accent hint en-IN for South-Asian L1s)
    → transcript + confidence + speaking seconds
    → POST /api/session/:id/turn
    → Claude → reply text
    → /api/tts (ElevenLabs Turbo v2.5 streaming, if configured) ─┐
      else on-device voice (prefers Microsoft *Natural*/Google voices) ─┤→ audio + mouth level → avatar
```

- **Speed control** 0.75× / 1× / 1.25× / 1.5×, voice styles (warm / clear / energetic), captions on/off, voice on/off, replay, **barge-in** (tap the mic to interrupt Maya).
- **Consent:** first mic use shows a consent dialog; `voiceConsentAt` is stored and revocable in Profile → Privacy. Raw audio is never stored.
- **Production upgrade path:** browser STT varies by browser (Chrome/Edge/Safari only). For consistent quality and real phoneme-level pronunciation scoring, add a streaming STT provider behind the same `listen()` contract — Deepgram Nova (low latency) or Azure Speech *Pronunciation Assessment* (per-phoneme accuracy). The turn API already accepts `sttConfidence` and `speakingSeconds`.

## 6. Avatar pipeline

**Implemented:** `TeacherAvatar.tsx`, a layered SVG portrait animated at 60fps outside React's render cycle:
lip-sync from audio amplitude (neural TTS via `AnalyserNode`) or word boundaries (browser TTS); rounded-vowel mouth shapes; natural blinking incl. occasional double blinks; eye saccades (looks up-left when thinking, at the learner when listening); head tilt, nods while speaking, breathing; a subtle hand gesture; seven emotions driven by Claude (`smile, encourage, laugh, think, impressed, listen, neutral`); `prefers-reduced-motion` respected.

**Honest limitation:** the built-in portrait is a polished *illustrated* teacher, not a photoreal human. The brief's cinematic photoreal avatar requires a real-time video-avatar vendor. The component's props (`state`, `emotion`, `levelRef`) are the adapter contract:

| Option | Fit | Notes |
|---|---|---|
| **Simli / Tavus / HeyGen Interactive Avatar** (WebRTC streaming) | photoreal, real-time lip-sync from our TTS audio | ~$0.10–0.30/min — must be metered (`AVATAR_PROVIDER=video` already adds avatar cost into `UsageDay`) |
| **Pre-rendered idle/reaction loops + streamed mouth** | cheaper, very fast load | good for the free tier |
| **Built-in portrait** (this repo) | $0, instant on 3G | fallback when avatar minutes are exhausted or on low-end devices |

Recommended: photoreal streaming avatar for Premium/Pro, built-in portrait for Free and as automatic fallback. Scenes (café, office, airport, interview room, hotel, restaurant…) are CSS layers per lesson (`SCENES`), swappable for video backplates.

## 7. Learning engine

`learning/skills.ts` — seven skills (speaking, grammar, vocabulary, pronunciation, fluency, confidence, listening). Each turn's signals become observations; scores update with an exponential moving average whose learning rate decays with evidence (fast early placement, stable later). Fluency blends Claude's judgment with words-per-minute; listening is inferred from whether the learner actually answered; pronunciation comes from STT confidence in conversation and from word alignment in the Lab.

**Adaptive difficulty:** three strong turns in a row → `harder`; two weak turns → `easier`; injected into the prompt every turn. **CEFR progression** (A1→C2) promotes one band at a time and only after ≥40 skill samples; the assessment sets the level directly.

## 8. Memory system

`learning/memory.ts` + `MistakePattern`. Every correction carries a stable `patternKey` (e.g. `for_vs_since`). Repeats reset the review interval and lower ease; correct use (Claude reports it in `usedCorrectly`) multiplies the interval; at 21+ days a pattern is **mastered**. Each turn, the top 3 due/frequent patterns are injected so Maya *steers the conversation* to create natural chances to use them — exactly the brief's “for vs since” example. Mistakes are recorded for every user; cross-session steering is a Premium feature (`mistake_memory`).

## 9. Progress system

`services/progress.ts` → `/progress`: six skill bars (/100), current level → next level progress, speaking minutes, words spoken, lessons completed, streak, 7-day speaking chart, common mistakes (with “✓ fixed”), achievements, recent sessions. Gamification (`gamification.ts`): XP per turn (speaking earns more than typing; longer answers earn more), session/daily-challenge/roleplay-goal bonuses, quadratic level curve, timezone-aware streaks, 11 achievements (“First Conversation”, “10 Minutes Spoken”, “7 Day Streak”, “100 New Words”, “Interview Ready”, “Confident Speaker”…).

## 10. Subscription system

- **Plans** (`config/plans.ts`): Free / Premium / Pro with limits (conversations, teacher turns, avatar minutes, roleplays, drills per day) and feature entitlements. Display prices are configurable; the authoritative price is the Stripe Price ID in env, so pricing and regional pricing change without a deploy.
- **Entitlements** (`billing/entitlements.ts`): `effectivePlan` handles trials, `past_due` grace until period end, and cancellation. Every gated action calls `checkLimit`/`hasFeature`; the API returns `402` with contextual upgrade copy.
- **Stripe:** Checkout (7-day trial on first subscription, promo codes), Billing Portal, and a signature-verified webhook that mirrors subscription state and emits `subscribed`/`churned` events. Without Stripe keys, a **demo mode** activates plans directly (dev always; staging only with `BILLING_DEMO_MODE=true`).

## 11. Admin dashboard

`/admin` (accounts in `ADMIN_EMAILS` or `role=admin`): total/new/active/free/paid users, plan mix, MRR, ARR, conversion, churn, ARPU, LTV, CAC, LTV:CAC, AI cost per user and per paying user, gross margin (with a warning under 60%), daily active learners chart, average session length, speaking minutes, D1/D7/D30 retention, avatar and voice minutes, TTS characters, LLM tokens, funnel (signup → onboarded → session → upgrade prompt → checkout → subscribed), most-used lessons, most common mistakes. JSON at `/api/admin/metrics`. `npm run db:seed` fills it with realistic demo data.

## 12. Analytics

Server-side events (`analytics/track.ts`) for signup, onboarding, sessions, level-ups, checkout, subscribe, churn, payment failure, account deletion; a small allow-listed client endpoint (`/api/events`) for upgrade-prompt impressions/clicks, pricing views and mic denials. Acquisition source (UTM/referrer) is stored on the user for CAC by channel. For scale, forward the same events to PostHog/Amplitude — the event names are the contract.

## 13. Authentication

Guest-first: a signed, httpOnly, `SameSite=Lax` JWT cookie (`jose`, HS256, 90 days) is issued at onboarding so learners speak before any signup. Email + password (scrypt, timing-safe compare) upgrades the guest in place. Rate-limited login/register. Admin by allow-list or role. Recommended next: Google/Apple sign-in and magic links via Auth.js, keeping the same `User` table.

## 14. Responsive UI & accessibility

Mobile-first: big thumb-reachable mic button, bottom tab bar (Home · Practice · Roleplay · Pronounce · Progress · Profile), stage + subtitles in the top half, safe-area insets, no horizontal scroll at 390px; two-column layout on desktop. Accessibility: captions, adjustable text size (4 steps), voice speed, keyboard input everywhere, visible focus rings, `aria-live` regions for teacher replies and listening state, meters/progressbars with ARIA values, screen-reader table behind each chart, reduced-motion support, AA-contrast dark theme.

## 15. Production deployment

| Concern | Recommendation |
|---|---|
| App | Vercel (or any Node 22 host / container). Turn API has `maxDuration = 60`. |
| Database | Managed Postgres (Neon, Supabase, RDS) with PgBouncer; `prisma migrate deploy` in CI |
| Secrets | `SESSION_SECRET` (32+ chars, required in prod), `ANTHROPIC_API_KEY`, `STRIPE_*`, `ELEVENLABS_*` |
| Rate limiting | in-memory limiter included; replace with Upstash Redis for multi-instance |
| Observability | Sentry for errors; log `usage` per turn; alert on gross margin < 60% and p95 turn latency > 4s |
| Security headers | set in `next.config.ts` (`nosniff`, referrer policy, `microphone=(self)`) |
| Data | encrypted at rest (managed DB), no raw audio stored, export (`/api/me/export`) and delete (`DELETE /api/me`, also cancels Stripe) |
| CI | `npm run lint` (tsc), `npm test` (vitest), `npm run build` |

### Latency budget (speak mode, target < 2.5s to first audio)

STT finalisation ~0.3s (silence detection) → Claude at `low` effort ~1–1.5s → TTS first byte ~0.3s (streaming). Next step for lower latency: stream the `reply` field and start TTS on the first sentence.
