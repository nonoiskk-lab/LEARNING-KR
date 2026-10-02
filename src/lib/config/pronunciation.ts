export interface Drill {
  id: string;
  unit: string;
  focus: string;
  text: string;
  stress?: string; // stress / intonation guide
  tip: string;
  premium?: boolean;
}

export const PRONUNCIATION_UNITS = [
  { id: "sounds", title: "Individual sounds", description: "TH, V/W, R/L and other tricky sounds" },
  { id: "words", title: "Difficult words", description: "Words learners often mispronounce" },
  { id: "word_stress", title: "Word stress", description: "Which syllable gets the beat" },
  { id: "sentence_stress", title: "Sentence stress & rhythm", description: "Stress the words that carry meaning" },
  { id: "intonation", title: "Intonation", description: "Rising and falling tones for questions and feelings" },
  { id: "connected", title: "Connected speech", description: "How natives link words together" },
];

export const DRILLS: Drill[] = [
  { id: "th-1", unit: "sounds", focus: "TH /θ/", text: "I think three things are worth it.", tip: "Tongue lightly between your teeth, then blow: th-ink, th-ree." },
  { id: "th-2", unit: "sounds", focus: "TH /ð/", text: "This is the weather they like.", tip: "Same tongue position as 'think', but switch your voice on: th-is, th-ey." },
  { id: "vw-1", unit: "sounds", focus: "V vs W", text: "We visited a very wide valley.", tip: "V: top teeth on lower lip. W: round lips, no teeth." },
  { id: "rl-1", unit: "sounds", focus: "R vs L", text: "The red lorry rolled really slowly.", tip: "L: tongue tip touches behind top teeth. R: tongue pulled back, touching nothing.", premium: true },
  { id: "short-long-i", unit: "sounds", focus: "ship vs sheep", text: "Please sit in this seat.", tip: "'sit' is short and relaxed; 'seat' is long with a smile.", premium: true },
  { id: "w-1", unit: "words", focus: "Common words", text: "Wednesday, comfortable, vegetable, February.", tip: "WENZ-day, KUMF-tuh-bl, VEJ-tuh-bl, FEB-roo-ree — some letters are silent." },
  { id: "w-2", unit: "words", focus: "Work words", text: "The schedule for the development is determined.", tip: "SHED-yool (UK) / SKED-jool (US), de-VEL-up-ment, de-TER-mind." },
  { id: "w-3", unit: "words", focus: "Tricky words", text: "Clothes, specific, and pronunciation.", tip: "Clothes rhymes with 'goes'. spe-SIF-ic. pro-NUN-see-AY-shun (not pro-NOUN-).", premium: true },
  { id: "ws-1", unit: "word_stress", focus: "Nouns vs verbs", text: "I need a record of what you record.", stress: "a REC-ord … you re-CORD", tip: "Two-syllable nouns usually stress the first syllable, verbs the second." },
  { id: "ws-2", unit: "word_stress", focus: "-tion words", text: "Communication and information need attention.", stress: "communi-CA-tion, infor-MA-tion, at-TEN-tion", tip: "Stress the syllable right before -tion." },
  { id: "ss-1", unit: "sentence_stress", focus: "Content words", text: "I want to buy a new phone this week.", stress: "I WANT to BUY a NEW PHONE this WEEK.", tip: "Stress nouns, main verbs and adjectives; let small words go quick and soft." },
  { id: "ss-2", unit: "sentence_stress", focus: "Contrastive stress", text: "I didn't say she stole the money.", stress: "Try stressing a different word each time — the meaning changes!", tip: "The stressed word is the one you're correcting or contrasting.", premium: true },
  { id: "in-1", unit: "intonation", focus: "Yes/no questions ↗", text: "Are you coming to the meeting?", stress: "Rise at the end ↗ meeting?", tip: "Yes/no questions usually rise at the end." },
  { id: "in-2", unit: "intonation", focus: "Wh- questions ↘", text: "Where are you from?", stress: "Fall at the end ↘ from?", tip: "Wh- questions usually fall at the end." },
  { id: "cs-1", unit: "connected", focus: "Linking", text: "Pick it up and put it on.", stress: "Pi-ki-tu-pand-pu-ti-ton", tip: "When a word ends in a consonant and the next starts with a vowel, link them.", premium: true },
  { id: "cs-2", unit: "connected", focus: "Gonna / wanna", text: "I'm going to want to talk to you.", stress: "I'm gonna wanna talk tuh you", tip: "In relaxed speech 'going to' → 'gonna', 'want to' → 'wanna'. Use in conversation, not formal writing.", premium: true },
];
