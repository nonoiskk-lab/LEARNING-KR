# Fluentia — AI Spoken-English Coach

Practise real conversations with **Maya**, an AI English teacher avatar. Learners speak or type in English (or their own language, as a bridge), get natural replies with gentle corrections, and track their progress from A1 to C2. Built as a commercial SaaS: freemium plans, Stripe billing, usage metering, and an admin dashboard with unit economics.

> Maya is always presented as an AI teacher, never as a human.

## What's in the box

| Area | Where |
|---|---|
| Landing page, onboarding (Speak/Type → native language → level → assessment chat) | `src/app/page.tsx`, `src/components/OnboardingClient.tsx` |
| Live session: avatar + voice + captions, speak/type, corrections, native-language bridge, XP | `src/components/SessionClient.tsx` |
| Animated teacher avatar (lip-sync, blinking, gaze, emotions, gestures) | `src/components/TeacherAvatar.tsx` |
| Voice pipeline (speech recognition, neural/browser TTS, 0.75–1.5× speed) | `src/lib/voice/client.ts`, `src/app/api/tts` |
| AI teacher brain (Claude, structured output, prompt caching) + offline demo tutor | `src/lib/ai/` |
| Learning engine: skills, adaptive difficulty, CEFR, mistake memory (spaced repetition), XP/streaks | `src/lib/learning/`, `src/lib/services/learning.ts` |
| 9 learning modes, 26 roleplay scenarios with scene changes, pronunciation lab | `src/lib/config/`, `/practice`, `/roleplay`, `/pronunciation` |
| Progress dashboard, achievements | `/progress` |
| Plans, entitlements, metering, Stripe checkout/portal/webhook | `src/lib/billing/`, `src/app/api/billing/` |
| Admin: MRR, ARR, churn, LTV, CAC, AI cost/user, gross margin, retention, funnel | `/admin`, `src/lib/analytics/metrics.ts` |
| Privacy: voice consent, data export, account deletion | `/profile`, `src/app/api/me/` |

Docs: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (all 15 build areas) · **[docs/BUSINESS.md](docs/BUSINESS.md)** (pricing, conversion, metrics, AI cost model).

## Quick start

```bash
npm install
cp .env.example .env          # works as-is: offline demo tutor, browser voice, demo billing
npx prisma db push            # creates the SQLite dev database
npm run dev                   # http://localhost:3000
```

Optional:

- `ANTHROPIC_API_KEY=...` → the real Claude teacher (default model `claude-opus-5-5`, set `TEACHER_MODEL` to change).
- `TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` → premium neural voice.
- `STRIPE_*` keys and price IDs → real subscriptions (webhook: `/api/billing/webhook`).
- `npm run db:seed` → 120 demo learners for the admin dashboard; log in as `admin@example.com` / `supersecret1` and open `/admin`.

Speech recognition uses the browser's Web Speech API (Chrome, Edge, Safari). Other browsers fall back to Type mode automatically.

## Checks

```bash
npm run lint    # TypeScript
npm test        # Vitest — learning engine, memory, pronunciation scoring, entitlements, unit economics, demo tutor
npm run build
```

## Production notes

Switch Prisma to PostgreSQL, set a strong `SESSION_SECRET`, configure Stripe, and keep `BILLING_DEMO_MODE` off. For photoreal avatars, plug a streaming avatar vendor in behind the `TeacherAvatar` props contract — see ARCHITECTURE §6 and the cost model in BUSINESS.md before enabling it.
