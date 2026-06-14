import { z } from "zod";

const ACTIVITY_TYPES = [
  "quran",
  "dhikr",
  "nafile",
  "fasting",
  "sadaka",
  "dua",
  "memorization",
] as const;

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG formatında olmalı");

// value şekli aktiviteye göre değişir (pages, count, rakaat...) — nesne olmasını
// garanti ediyoruz, içerik esnek.
const valueObject = z.record(z.string(), z.any());

export const logActivitySchema = z.object({
  activity_type: z.enum(ACTIVITY_TYPES),
  value: valueObject,
  notes: z.string().max(1000).optional(),
  date: dateStr.optional(),
});

export const updateLogSchema = z.object({
  value: valueObject.optional(),
  notes: z.string().max(1000).optional(),
});
