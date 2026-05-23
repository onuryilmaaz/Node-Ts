import { db } from "../../db";
import { addPointsForActivity } from "../gamification/gamification.service";
import { reflectToGroups } from "../group/group.service";

export function calculatePoints(type: string, value: Record<string, unknown>): number {
  switch (type) {
    case "quran": return Math.ceil((Number(value.pages) || 0) * 2);
    case "dhikr": return Math.max(1, Math.ceil((Number(value.count) || 0) / 33));
    case "nafile": return Math.ceil((Number(value.rakaat) || 0) * 2);
    case "fasting": return 30;
    case "sadaka": return 10;
    case "dua": return Math.max(1, Math.ceil((Number(value.minutes) || 0) / 15) * 3);
    case "memorization":
      return (Number(value.new_ayets) || 0) * 10 + (Number(value.revision_ayets) || 0) * 3;
    default: return 5;
  }
}

function getTurkishDateStr(): string {
  const nowTR = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
  );
  return nowTR.toISOString().split("T")[0]!;
}

export async function logActivity(
  userId: string,
  activityType: string,
  value: Record<string, unknown>,
  notes?: string,
  date?: string,
) {
  const targetDate = date ?? getTurkishDateStr();

  const result = await db.execute(
    `INSERT INTO app.tracker_logs (user_id, date, activity_type, value, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, targetDate, activityType, JSON.stringify(value), notes ?? null],
  );
  const log = result.rows[0];
  const points = calculatePoints(activityType, value);
  addPointsForActivity(userId, points).catch(() => {});
  reflectToGroups(userId, log.id, activityType, value).catch((e) =>
    console.error("reflectToGroups error:", e),
  );
  return log;
}

export async function updateLog(
  userId: string,
  id: string,
  value: Record<string, unknown>,
  notes?: string,
) {
  const result = await db.execute(
    `UPDATE app.tracker_logs
     SET value = $1, notes = $2
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [JSON.stringify(value), notes ?? null, id, userId],
  );
  return result.rows[0] ?? null;
}

export async function deleteLog(userId: string, id: string) {
  await db.execute(
    `DELETE FROM app.tracker_logs WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function getTodayLogs(userId: string) {
  const today = getTurkishDateStr();
  const result = await db.execute(
    `SELECT id, date, activity_type, value, notes, created_at
     FROM app.tracker_logs
     WHERE user_id = $1 AND date = $2
     ORDER BY created_at ASC`,
    [userId, today],
  );
  return result.rows;
}

export async function getLogsForDate(userId: string, date: string) {
  const result = await db.execute(
    `SELECT id, date, activity_type, value, notes, created_at
     FROM app.tracker_logs
     WHERE user_id = $1 AND date = $2
     ORDER BY created_at ASC`,
    [userId, date],
  );
  return result.rows;
}

export async function getWeeklyStats(userId: string) {
  const result = await db.execute(
    `SELECT
       date,
       activity_type,
       COUNT(*) as entry_count,
       jsonb_agg(value ORDER BY created_at) as values
     FROM app.tracker_logs
     WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '6 days'
       AND date <= CURRENT_DATE
     GROUP BY date, activity_type
     ORDER BY date ASC, activity_type ASC`,
    [userId],
  );

  const dailyMap: Record<string, Record<string, unknown>> = {};
  for (const row of result.rows) {
    const dateKey = row.date instanceof Date
      ? row.date.toISOString().split("T")[0]
      : String(row.date).split("T")[0];

    if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
    dailyMap[dateKey][row.activity_type] = {
      entry_count: Number(row.entry_count),
      values: row.values,
    };
  }

  // Build last 7 days array
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, activities: dailyMap[dateStr!] ?? {} });
  }

  // Compute per-type weekly totals
  const totals: Record<string, number> = {};
  for (const day of days) {
    for (const [type, data] of Object.entries(day.activities)) {
      const vals = (data as any).values as Record<string, unknown>[];
      const sum = aggregateValues(type, vals);
      totals[type] = (totals[type] ?? 0) + sum;
    }
  }

  return { days, totals };
}

export async function getMonthlyStats(userId: string, year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? (now.getMonth() + 1);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(y, m, 0).toISOString().split("T")[0];

  const result = await db.execute(
    `SELECT
       date,
       activity_type,
       COUNT(*) as entry_count,
       jsonb_agg(value ORDER BY created_at) as values
     FROM app.tracker_logs
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3
     GROUP BY date, activity_type
     ORDER BY date ASC, activity_type ASC`,
    [userId, monthStart, monthEnd],
  );

  const dailyMap: Record<string, Record<string, unknown>> = {};
  for (const row of result.rows) {
    const dateKey = row.date instanceof Date
      ? row.date.toISOString().split("T")[0]
      : String(row.date).split("T")[0];

    if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
    dailyMap[dateKey][row.activity_type] = {
      entry_count: Number(row.entry_count),
      values: row.values,
    };
  }

  // Per-type monthly totals
  const totals: Record<string, number> = {};
  const activeDays = new Set<string>();

  for (const [date, activities] of Object.entries(dailyMap)) {
    activeDays.add(date);
    for (const [type, data] of Object.entries(activities)) {
      const vals = (data as any).values as Record<string, unknown>[];
      const sum = aggregateValues(type, vals);
      totals[type] = (totals[type] ?? 0) + sum;
    }
  }

  return {
    year: y,
    month: m,
    daily: dailyMap,
    totals,
    active_days: activeDays.size,
  };
}

// Aggregate numeric value from JSONB entries per activity type
function aggregateValues(type: string, values: Record<string, unknown>[]): number {
  if (!values?.length) return 0;
  switch (type) {
    case "quran":
      return values.reduce((s, v) => s + (Number((v as any).pages) || 0), 0);
    case "dhikr":
      return values.reduce((s, v) => s + (Number((v as any).count) || 0), 0);
    case "nafile":
      return values.reduce((s, v) => s + (Number((v as any).rakaat) || 0), 0);
    case "fasting":
      return values.length;
    case "sadaka":
      return values.reduce((s, v) => s + (Number((v as any).amount) || 0), 0);
    case "dua":
      return values.reduce((s, v) => s + (Number((v as any).minutes) || 0), 0);
    case "memorization":
      return values.reduce(
        (s, v) => s + (Number((v as any).new_ayets) || 0) + (Number((v as any).revision_ayets) || 0),
        0,
      );
    default:
      return values.length;
  }
}
