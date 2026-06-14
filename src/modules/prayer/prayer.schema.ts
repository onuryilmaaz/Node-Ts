import { z } from "zod";

export interface PrayerDailyQuery {
  city?: string;
}

const PRAYER_TIMES = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG formatında olmalı");

export const trackPrayerSchema = z.object({
  prayer_time: z.enum(PRAYER_TIMES),
  is_kaza: z.boolean().optional(),
  date: dateStr.optional(),
});

export const untrackPrayerSchema = z.object({
  prayer_time: z.enum(PRAYER_TIMES),
  date: dateStr.optional(),
});

export const addKazaSchema = z.object({
  prayer_time: z.enum(PRAYER_TIMES),
  missed_date: dateStr.optional(),
});

export const batchAddKazaSchema = z.object({
  prayers: z.array(z.enum(PRAYER_TIMES)).min(1),
  count: z.number().int().positive().max(10000),
});

export const quickKazaSchema = z.object({
  prayer_time: z.enum(PRAYER_TIMES),
});
