import type { Feature } from "./plans";

export type ModeId =
  | "free"
  | "daily"
  | "business"
  | "interview"
  | "travel"
  | "daily_life"
  | "pronunciation"
  | "vocabulary"
  | "roleplay"
  | "assessment";

export interface Mode {
  id: ModeId;
  icon: string;
  title: string;
  blurb: string;
  scene: SceneId;
  requires?: Feature;
  minutes?: number;
  teacherBrief: string;
}

export type SceneId = "studio" | "cafe" | "office" | "interview" | "airport" | "hotel" | "restaurant" | "street" | "shop" | "meeting";

export interface Scene {
  id: SceneId;
  name: string;
  /** layered CSS backgrounds — cheap, instant, no asset download on mobile */
  background: string;
  ambient: string;
}

export const SCENES: Record<SceneId, Scene> = {
  studio: { id: "studio", name: "Teacher's studio", background: "radial-gradient(120% 90% at 50% 10%, #2a3b55 0%, #121a28 60%, #0b111b 100%)", ambient: "warm desk lamp, bookshelf" },
  cafe: { id: "cafe", name: "Modern café", background: "radial-gradient(90% 70% at 20% 20%, #6b4a32 0%, transparent 60%), radial-gradient(80% 60% at 85% 30%, #a0784f55 0%, transparent 60%), linear-gradient(180deg, #2b2019, #15100c)", ambient: "espresso machine, soft chatter" },
  office: { id: "office", name: "Modern office", background: "linear-gradient(90deg, #1b2733 0 18%, #223242 18% 20%, #1b2733 20% 60%, #223242 60% 62%, #1b2733 62%), linear-gradient(180deg, #8fb3d955, transparent 55%), #121b25", ambient: "glass walls, city view" },
  interview: { id: "interview", name: "Interview room", background: "radial-gradient(80% 60% at 50% 0%, #e7e2d855 0%, transparent 70%), linear-gradient(180deg, #2d3036, #17191d)", ambient: "quiet, formal" },
  airport: { id: "airport", name: "Airport terminal", background: "linear-gradient(180deg, #9cc3e655 0%, transparent 45%), repeating-linear-gradient(90deg, #1d2a38 0 60px, #233344 60px 64px), #152030", ambient: "boarding announcements" },
  hotel: { id: "hotel", name: "Hotel lobby", background: "radial-gradient(70% 50% at 50% 0%, #e0b97055 0%, transparent 70%), linear-gradient(180deg, #3a2c1f, #1a140e)", ambient: "marble, soft piano" },
  restaurant: { id: "restaurant", name: "Restaurant", background: "radial-gradient(40% 30% at 25% 30%, #ffcf8a44, transparent), radial-gradient(40% 30% at 75% 25%, #ffcf8a33, transparent), linear-gradient(180deg, #2a1717, #120a0a)", ambient: "candles, cutlery" },
  street: { id: "street", name: "City street", background: "linear-gradient(180deg, #7aa6d655 0%, transparent 50%), linear-gradient(0deg, #2b2f36 0 30%, transparent 30%), #1a2230", ambient: "traffic, footsteps" },
  shop: { id: "shop", name: "Store", background: "repeating-linear-gradient(0deg, #2a3530 0 40px, #33423b 40px 44px), #1c2420", ambient: "checkout beeps" },
  meeting: { id: "meeting", name: "Client meeting room", background: "linear-gradient(180deg, #cfd9e655 0%, transparent 40%), linear-gradient(90deg, #1e2834, #263342 50%, #1e2834)", ambient: "conference table, screen" },
};

export const MODES: Mode[] = [
  { id: "free", icon: "🗣️", title: "Free Conversation", blurb: "Talk about anything with your teacher.", scene: "cafe", teacherBrief: "Open, friendly conversation. Follow the learner's interests. Keep it flowing with genuine follow-up questions." },
  { id: "daily", icon: "🎯", title: "Daily Speaking", blurb: "Today's 10-minute challenge.", scene: "studio", minutes: 10, teacherBrief: "A focused 10-minute speaking challenge on today's topic. Mix in one review of a past mistake. Encourage longer answers." },
  { id: "business", icon: "💼", title: "Business English", blurb: "Meetings, emails out loud, small talk at work.", scene: "office", requires: "business_english", teacherBrief: "Professional communication practice: meetings, updates, polite requests, disagreement, small talk with colleagues." },
  { id: "interview", icon: "🎤", title: "Interview Practice", blurb: "A realistic AI interviewer with feedback.", scene: "interview", requires: "interview_practice", teacherBrief: "Act as a friendly but realistic interviewer. Ask one standard question at a time (tell me about yourself, strengths, a challenge, why this role). After each answer give brief coaching, then the next question." },
  { id: "travel", icon: "✈️", title: "Travel English", blurb: "Airports, hotels, taxis, directions.", scene: "airport", teacherBrief: "Travel situations: check-in, immigration, hotel, taxi, directions. Keep it practical and polite." },
  { id: "daily_life", icon: "🛒", title: "Daily Life English", blurb: "Shopping, ordering food, phone calls.", scene: "shop", teacherBrief: "Everyday errands: shopping, restaurants, phone calls, neighbours. Practical, polite, natural phrases." },
  { id: "pronunciation", icon: "🔊", title: "Pronunciation", blurb: "Sounds, stress, rhythm and intonation.", scene: "studio", teacherBrief: "Pronunciation coaching. Keep turns short. Model words and sentences, explain mouth position simply, give stress patterns in CAPS (e.g. de-VEL-op)." },
  { id: "vocabulary", icon: "🧠", title: "Vocabulary", blurb: "Learn words in context and use them.", scene: "studio", teacherBrief: "Context-based vocabulary. Introduce 1 useful word or phrase per turn, give an example, then ask the learner to use it in their own sentence." },
  { id: "roleplay", icon: "🎬", title: "Roleplay", blurb: "Step into a real-life scene.", scene: "street", teacherBrief: "Immersive roleplay. Stay in character, but step out briefly for corrections." },
  { id: "assessment", icon: "📋", title: "Level check", blurb: "A short chat to find your level.", scene: "studio", teacherBrief: "A friendly 6-turn placement conversation. Turn by turn, gradually raise difficulty: name & home, daily routine, a past event, future plans, an opinion with reasons, a hypothetical. Never mention it's a test." },
];

export function getMode(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
