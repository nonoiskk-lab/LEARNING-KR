import { z } from "zod/v4";

export const CORRECTION_CATEGORIES = ["grammar", "vocabulary", "pronunciation", "structure", "naturalness", "word_choice", "fluency"] as const;
export const EMOTIONS = ["smile", "encourage", "laugh", "think", "impressed", "neutral", "listen"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const CorrectionSchema = z.object({
  category: z.enum(CORRECTION_CATEGORIES),
  youSaid: z.string().describe("The learner's exact words that need work (short excerpt)."),
  better: z.string().describe("A grammatically correct version."),
  moreNatural: z.string().describe("How a fluent speaker would naturally say it."),
  why: z.string().describe("One short, friendly sentence explaining the rule. Max 20 words."),
  patternKey: z.string().describe("Stable snake_case id for this kind of error, e.g. for_vs_since, missing_article, present_perfect_duration, v_w_confusion."),
  patternLabel: z.string().describe("Human label for the pattern, e.g. 'for vs since'."),
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const TeacherTurnSchema = z.object({
  reply: z
    .string()
    .describe("What the teacher SAYS aloud. Warm, natural spoken English. If there is an important correction, weave it in briefly and kindly, then continue the conversation and end with ONE question."),
  corrections: z.array(CorrectionSchema).describe("0 to 3 most important corrections from the learner's last message. Empty if none matter."),
  nativeBridge: z
    .object({
      learnerSaid: z.string(),
      english: z.string().describe("Natural English for what the learner meant."),
      tip: z.string().describe("Short tip, may use the learner's native language, nudging them to say it in English next time."),
    })
    .nullable()
    .describe("Only when the learner used their native language (script or romanised). Otherwise null."),
  emotion: z.enum(EMOTIONS).describe("Avatar reaction to the learner's message."),
  understoodTeacher: z.boolean().describe("Did the learner's message sensibly respond to the teacher's previous question?"),
  signals: z
    .object({
      grammar: z.number().describe("0-100"),
      vocabulary: z.number().describe("0-100"),
      fluency: z.number().describe("0-100, from sentence flow, fillers, fragments"),
      structure: z.number().describe("0-100, sentence formation"),
      confidence: z.number().describe("0-100, from answer length, hedging, completeness"),
      complexity: z.number().describe("0-100, range of structures/words used"),
    })
    .describe("Scores for the learner's LAST message only, judged against native-like English (not against their level)."),
  newVocabulary: z
    .array(z.object({ word: z.string(), meaning: z.string(), example: z.string() }))
    .describe("0-2 useful words/phrases the teacher introduced this turn."),
  usedCorrectly: z.array(z.string()).describe("patternKeys from the learner's focus list that they used CORRECTLY in this message."),
  goalAchieved: z.boolean().describe("Roleplay/session goal reached in this message. False if no goal."),
  levelEstimate: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable().describe("Placement estimate, only in assessment mode after 4+ learner turns; otherwise null."),
});
export type TeacherTurn = z.infer<typeof TeacherTurnSchema>;
