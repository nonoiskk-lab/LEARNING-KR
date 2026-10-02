/**
 * Supported native languages. Adding a language = adding one entry here
 * (plus optional bridge phrases). The teacher prompt, onboarding and
 * native-language bridge all read from this registry.
 */
export interface NativeLanguage {
  code: string; // BCP-47 primary tag
  name: string; // English name
  native: string; // endonym shown in the picker
  script: "latin" | "devanagari" | "bengali" | "tamil" | "telugu" | "gujarati" | "gurmukhi" | "arabic" | "cjk" | "hangul";
  rtl?: boolean;
  /** Learners often type this language in Latin letters (e.g. Hinglish). */
  romanized?: boolean;
  greeting: string;
}

export const LANGUAGES: NativeLanguage[] = [
  { code: "hi", name: "Hindi", native: "हिन्दी", script: "devanagari", romanized: true, greeting: "नमस्ते" },
  { code: "bn", name: "Bengali", native: "বাংলা", script: "bengali", romanized: true, greeting: "নমস্কার" },
  { code: "ta", name: "Tamil", native: "தமிழ்", script: "tamil", romanized: true, greeting: "வணக்கம்" },
  { code: "te", name: "Telugu", native: "తెలుగు", script: "telugu", romanized: true, greeting: "నమస్కారం" },
  { code: "mr", name: "Marathi", native: "मराठी", script: "devanagari", romanized: true, greeting: "नमस्कार" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", script: "gujarati", romanized: true, greeting: "નમસ્તે" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "gurmukhi", romanized: true, greeting: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ" },
  { code: "ur", name: "Urdu", native: "اردو", script: "arabic", rtl: true, romanized: true, greeting: "السلام علیکم" },
  { code: "es", name: "Spanish", native: "Español", script: "latin", greeting: "Hola" },
  { code: "fr", name: "French", native: "Français", script: "latin", greeting: "Bonjour" },
  { code: "de", name: "German", native: "Deutsch", script: "latin", greeting: "Hallo" },
  { code: "ar", name: "Arabic", native: "العربية", script: "arabic", rtl: true, greeting: "مرحبا" },
  { code: "pt", name: "Portuguese", native: "Português", script: "latin", greeting: "Olá" },
  { code: "ja", name: "Japanese", native: "日本語", script: "cjk", greeting: "こんにちは" },
  { code: "ko", name: "Korean", native: "한국어", script: "hangul", greeting: "안녕하세요" },
  { code: "zh", name: "Chinese (Mandarin)", native: "中文", script: "cjk", greeting: "你好" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", script: "latin", greeting: "Halo" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", script: "latin", greeting: "Xin chào" },
  { code: "tr", name: "Turkish", native: "Türkçe", script: "latin", greeting: "Merhaba" },
  { code: "ru", name: "Russian", native: "Русский", script: "latin", greeting: "Привет" },
];

export function getLanguage(code: string): NativeLanguage {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export const SELF_LEVELS = [
  { id: "beginner", label: "Beginner", cefr: "A1", hint: "I know a few words" },
  { id: "elementary", label: "Elementary", cefr: "A2", hint: "I can make simple sentences" },
  { id: "intermediate", label: "Intermediate", cefr: "B1", hint: "I understand a lot but hesitate when speaking" },
  { id: "upper_intermediate", label: "Upper Intermediate", cefr: "B2", hint: "I can talk about most topics" },
  { id: "advanced", label: "Advanced", cefr: "C1", hint: "I want to sound natural and polished" },
  { id: "unsure", label: "I'm not sure", cefr: null, hint: "Let's find out with a short chat" },
] as const;

export type SelfLevelId = (typeof SELF_LEVELS)[number]["id"];
