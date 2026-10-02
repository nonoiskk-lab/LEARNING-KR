# Fluentia — Business Model, Monetization & Metrics

The product optimises two things at once: **learning outcomes** and **business sustainability**. Every number below is configurable (`src/lib/config/plans.ts`, Stripe prices) — treat the defaults as starting hypotheses to test.

## Plans

| | Free | Premium | Pro |
|---|---|---|---|
| Display price | $0 | $12.99/mo · $89.99/yr | $24.99/mo · $179.99/yr |
| Conversations / day | 2 | unlimited | unlimited |
| Teacher replies / day (fair use) | 20 | 300 | 800 |
| Avatar minutes / day | 5 | 60 | 180 |
| Roleplays / day | 1 | unlimited | unlimited |
| Pronunciation drills | 5/day, basic units | full lab | full lab |
| Business English, Interview practice | – | ✓ | ✓ advanced |
| Mistake memory & personal plan | records only | ✓ | ✓ |
| Presentation training, deeper feedback, priority | – | – | ✓ |

For India and other price-sensitive markets, use Stripe regional prices (e.g. ₹299/mo, ₹1,999/yr) — no code change needed.

## Revenue lines

1. Monthly subscription  2. Annual subscription (default toggle on pricing page, ~40% saving)  3. Avatar-minute top-ups  4. Interview Preparation Pack  5. Business English Pack  6. Team plans (seats + manager view)  7. School/college plans  8. B2B licensing (white-label API for training providers)  9. Affiliate partnerships (exam prep, job boards) — only where they help the learner.

## Conversion system (non-intrusive by design)

- **No interruptions mid-conversation.** Limits are checked when a session *starts* and between turns; the upgrade sheet is dismissible and says what the learner already achieved (“You've completed today's free speaking session 🎉”).
- **Feature previews:** Premium modes and scenarios are visible with a PREMIUM tag and link to pricing with the source (`/pricing?from=interview`), so conversion can be attributed per feature.
- **Trial:** 7 days on first subscription. **Annual incentive:** yearly toggle selected by default.
- **Progress-based prompts:** Progress shows “Unlock mistake memory →” next to the learner's own recurring mistakes.
- Tracked funnel: `signup → onboarding_complete → session_start → upgrade_prompt_shown → upgrade_prompt_clicked → checkout_started → subscribed`, plus `churned`, `payment_failed`.

## Retention system

Daily topic + 10-minute challenge, streaks, XP levels, specific nudges built from the learner's own data (“Let's fix a habit: ‘…since two years’ → ‘…for two years’”, “You are 80 XP away from level 5”). Recommended channels next: web push and email (daily reminder at the learner's chosen time, max one per day, auto-paused after 3 ignored).

## Metric definitions (as computed in `src/lib/analytics/metrics.ts`)

| Metric | Definition |
|---|---|
| **MRR** | Σ normalised monthly revenue of active + past-due paid subscriptions (annual ÷ 12) |
| **ARR** | MRR × 12 |
| **Conversion rate** | paying users ÷ all users |
| **Monthly churn** | paid subs canceled in last 30 days ÷ paid subs existing 30 days ago |
| **ARPU** | MRR ÷ 30-day active users · **ARPPU** = MRR ÷ paying users |
| **AI cost / user** | Σ `UsageDay.costMicroUsd` (LLM + TTS + avatar) over 30 days ÷ active users |
| **Gross margin** | (MRR − 30-day AI cost) ÷ MRR |
| **LTV** | ARPPU × gross margin × min(36, 1 ÷ churn) months |
| **CAC** | marketing spend (admin-entered `MarketingSpend`) ÷ new paying users, 30 days; “—” when no spend is recorded |
| **Retention D1/D7/D30** | share of a signup cohort active exactly N days after signup |

## AI cost model — read this before setting prices

AI voice/avatar is the main variable cost. Rough per-turn estimate with the default `claude-opus-5-5` at `low` effort (≈1.5k cached system tokens, ≈1.5k fresh tokens, ≈600 output incl. thinking):

| Component | Per teacher turn | 20-turn (≈10 min) session |
|---|---|---|
| Claude Opus 5.5 | ≈ $0.018 | ≈ $0.36 |
| Claude Sonnet 5.5 (`TEACHER_MODEL=claude-sonnet-5-5`) | ≈ $0.008 | ≈ $0.16 |
| Google Gemini free tier (`TEACHER_PROVIDER=gemini`) | $0 within the free quota | $0 — fine for demos and small tests, not for real traffic |
| Neural TTS (ElevenLabs, ~180 chars) | ≈ $0.03 | ≈ $0.60 |
| Streaming photoreal avatar (~11 s) | ≈ $0.03–0.05 | ≈ $0.60–1.00 |
| Browser STT/TTS + built-in portrait | $0 | $0 |

**Implication:** a Premium learner doing one full-stack (Opus + neural TTS + video avatar) session every day costs ≈ $45–60/month — far above a $12.99 price. The defaults in this repo therefore ship with browser voice and the built-in avatar (≈ $0.36/session LLM-only), and the plan limits cap avatar minutes. Before launch:

1. Measure real token usage per turn from `UsageDay` (the admin dashboard shows it) — the estimates above are planning numbers, not measurements.
2. Run a quality eval comparing Opus 5.5 vs Sonnet 5.5 on real learner transcripts; if quality holds, route Free (and possibly Premium) to the cheaper model.
3. Reserve neural TTS + photoreal avatar for Pro or metered add-on minutes.
4. Alert when gross margin drops under 60%.
