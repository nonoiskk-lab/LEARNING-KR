export interface AchievementStats {
  sessions: number;
  speakingMinutes: number;
  streakDays: number;
  wordsLearned: number;
  interviewSessions: number;
  roleplays: number;
  confidence: number;
  level: string;
  masteredMistakes: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  test: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_conversation", title: "First Conversation", description: "Finished your first session", icon: "💬", test: (s) => s.sessions >= 1 },
  { id: "ten_minutes", title: "10 Minutes Spoken", description: "Spoke English for 10 minutes", icon: "⏱️", test: (s) => s.speakingMinutes >= 10 },
  { id: "hour_spoken", title: "One Hour Club", description: "Spoke English for 60 minutes", icon: "🕐", test: (s) => s.speakingMinutes >= 60 },
  { id: "streak_7", title: "7 Day Streak", description: "Practised 7 days in a row", icon: "🔥", test: (s) => s.streakDays >= 7 },
  { id: "streak_30", title: "30 Day Streak", description: "A month of daily practice", icon: "🏆", test: (s) => s.streakDays >= 30 },
  { id: "words_100", title: "100 New Words", description: "Added 100 words to your vocabulary", icon: "📚", test: (s) => s.wordsLearned >= 100 },
  { id: "roleplay_5", title: "Scene Stealer", description: "Completed 5 roleplays", icon: "🎬", test: (s) => s.roleplays >= 5 },
  { id: "interview_ready", title: "Interview Ready", description: "Completed 5 interview sessions", icon: "🎤", test: (s) => s.interviewSessions >= 5 },
  { id: "mistake_fixed", title: "Old Habit Broken", description: "Mastered a recurring mistake", icon: "✅", test: (s) => s.masteredMistakes >= 1 },
  { id: "confident_speaker", title: "Confident Speaker", description: "Reached 75+ confidence", icon: "🌟", test: (s) => s.confidence >= 75 },
  { id: "reached_b2", title: "Professional Level", description: "Reached B2", icon: "💼", test: (s) => ["B2", "C1", "C2"].includes(s.level) },
];
