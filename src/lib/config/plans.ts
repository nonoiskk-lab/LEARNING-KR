/**
 * Plan catalogue and entitlements. Prices are display values only — the
 * authoritative amount lives in the Stripe Price referenced by `stripePriceEnv`,
 * so pricing (and regional pricing) can change without a deploy.
 */
export type PlanId = "free" | "premium" | "pro";
export type Interval = "month" | "year";

export interface Limits {
  conversationsPerDay: number; // Infinity = unlimited
  teacherTurnsPerDay: number;
  avatarMinutesPerDay: number;
  roleplaysPerDay: number;
  pronunciationDrillsPerDay: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceDisplay: Record<Interval, string>;
  /** normalised monthly revenue in cents, used for MRR when Stripe is absent */
  mrrCents: Record<Interval, number>;
  stripePriceEnv: Record<Interval, string>;
  limits: Limits;
  features: string[];
  /** feature flags checked in code */
  entitlements: Feature[];
  highlight?: boolean;
}

export type Feature =
  | "business_english"
  | "interview_practice"
  | "premium_scenarios"
  | "advanced_pronunciation"
  | "mistake_memory"
  | "personal_plan"
  | "advanced_analytics"
  | "presentation_training"
  | "advanced_feedback"
  | "priority";

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Start speaking today",
    priceDisplay: { month: "$0", year: "$0" },
    mrrCents: { month: 0, year: 0 },
    stripePriceEnv: { month: "", year: "" },
    limits: {
      conversationsPerDay: 2,
      teacherTurnsPerDay: 20,
      avatarMinutesPerDay: 5,
      roleplaysPerDay: 1,
      pronunciationDrillsPerDay: 5,
    },
    features: [
      "2 conversations a day",
      "5 avatar minutes a day",
      "Basic pronunciation drills",
      "1 roleplay a day",
      "Progress tracking",
    ],
    entitlements: [],
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Your personal teacher, unlimited",
    priceDisplay: { month: "$12.99/mo", year: "$89.99/yr" },
    mrrCents: { month: 1299, year: 750 },
    stripePriceEnv: { month: "STRIPE_PRICE_PREMIUM_MONTHLY", year: "STRIPE_PRICE_PREMIUM_YEARLY" },
    limits: {
      conversationsPerDay: UNLIMITED,
      teacherTurnsPerDay: 300,
      avatarMinutesPerDay: 60,
      roleplaysPerDay: UNLIMITED,
      pronunciationDrillsPerDay: UNLIMITED,
    },
    features: [
      "Unlimited conversations & roleplays",
      "60 avatar minutes a day",
      "Business English & interview practice",
      "Advanced pronunciation lab",
      "Mistake memory & personal learning plan",
      "Advanced progress analytics",
    ],
    entitlements: [
      "business_english",
      "interview_practice",
      "premium_scenarios",
      "advanced_pronunciation",
      "mistake_memory",
      "personal_plan",
      "advanced_analytics",
    ],
    highlight: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For careers and business",
    priceDisplay: { month: "$24.99/mo", year: "$179.99/yr" },
    mrrCents: { month: 2499, year: 1500 },
    stripePriceEnv: { month: "STRIPE_PRICE_PRO_MONTHLY", year: "STRIPE_PRICE_PRO_YEARLY" },
    limits: {
      conversationsPerDay: UNLIMITED,
      teacherTurnsPerDay: 800,
      avatarMinutesPerDay: 180,
      roleplaysPerDay: UNLIMITED,
      pronunciationDrillsPerDay: UNLIMITED,
    },
    features: [
      "Everything in Premium",
      "180 avatar minutes a day",
      "Advanced business English & negotiation",
      "Interview & presentation training",
      "Deeper AI feedback on every answer",
      "Priority access to new features",
    ],
    entitlements: [
      "business_english",
      "interview_practice",
      "premium_scenarios",
      "advanced_pronunciation",
      "mistake_memory",
      "personal_plan",
      "advanced_analytics",
      "presentation_training",
      "advanced_feedback",
      "priority",
    ],
  },
};

export const TRIAL_DAYS = 7;

/** Revenue lines beyond subscriptions (see docs/BUSINESS.md). */
export const ADD_ONS = [
  { id: "avatar_minutes_60", name: "60 extra avatar minutes", priceDisplay: "$4.99" },
  { id: "interview_pack", name: "Interview Preparation Pack (30 days)", priceDisplay: "$19" },
  { id: "business_pack", name: "Business English Pack (30 days)", priceDisplay: "$19" },
];
