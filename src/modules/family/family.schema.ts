import { z } from "zod";

export const createChildSchema = z.object({
  name: z.string().min(1).max(50),
  birth_year: z.number().int().min(2000).max(2025).optional(),
  avatar_emoji: z.string().max(10).optional(),
  gender: z.enum(["erkek", "kız"]).optional(),
  pin_code: z.string().length(4).regex(/^\d{4}$/).optional(),
});

export const updateChildSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  birth_year: z.number().int().min(2000).max(2025).optional(),
  avatar_emoji: z.string().max(10).optional(),
  gender: z.enum(["erkek", "kız"]).optional(),
});

export const setPinSchema = z.object({
  pin_code: z.string().length(4).regex(/^\d{4}$/),
});

export const childSessionSchema = z.object({
  pin_code: z.string().length(4).regex(/^\d{4}$/),
});

export const createTaskSchema = z.object({
  task_type: z.enum(["prayer", "quran", "dua", "dhikr", "wudu", "memorization", "manners", "custom"]),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  recurrence: z.enum(["daily", "weekly", "once"]).default("daily"),
  scheduled_days: z.array(z.number().int().min(0).max(6)).optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reward_stars: z.number().int().min(1).max(10).default(1),
  requires_proof: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  recurrence: z.enum(["daily", "weekly", "once"]).optional(),
  scheduled_days: z.array(z.number().int().min(0).max(6)).optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reward_stars: z.number().int().min(1).max(10).optional(),
  requires_proof: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const completeTaskSchema = z.object({
  evidence_url: z.string().url().optional(),
});

export const reviewCompletionSchema = z.object({
  approved: z.boolean(),
  parent_note: z.string().max(300).optional(),
});

export const createRewardSchema = z.object({
  title: z.string().min(1).max(100),
  cost_stars: z.number().int().min(1).max(500),
});
