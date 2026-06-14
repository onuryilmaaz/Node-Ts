import { z } from "zod";

// goals.service VALID_ACTIVITIES ile uyumlu (sadaka hariç).
const GOAL_ACTIVITIES = [
  "quran",
  "dhikr",
  "nafile",
  "fasting",
  "dua",
  "memorization",
] as const;

export const upsertGoalSchema = z.object({
  activity_type: z.enum(GOAL_ACTIVITIES),
  target: z.number().int().positive().max(100000),
  enabled: z.boolean().optional(),
});
