import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  max_members: z.number().int().min(2).max(100).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  max_members: z.number().int().min(2).max(100).optional(),
  avatar_url: z.string().url().optional(),
});

export const addActivityTypeSchema = z.object({
  name: z.string().min(1).max(100),
  base_type: z
    .enum(["quran", "dhikr", "nafile", "fasting", "sadaka", "dua", "memorization"])
    .optional(),
  unit: z.string().min(1).max(30),
});

export const createGoalSchema = z.object({
  title: z.string().min(3).max(200),
  goal_type: z.enum(["group_total", "per_person", "streak"]),
  target_value: z.number().positive(),
  activity_type_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateGoalStatusSchema = z.object({
  status: z.enum(["draft", "active", "completed", "cancelled"]),
});

export const goalSuggestionSchema = z.object({
  title: z.string().min(3).max(200),
  goal_type: z.enum(["group_total", "per_person", "streak"]),
  target_value: z.number().positive(),
  activity_type_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().max(500).optional(),
});

export const reviewSuggestionSchema = z.object({
  approved: z.boolean(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["moderator", "member"]),
});

export const manualActivityLogSchema = z.object({
  activity_type_id: z.string().uuid(),
  value: z.number().positive(),
  notes: z.string().max(300).optional(),
});
