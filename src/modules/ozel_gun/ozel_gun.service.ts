import { query } from "../../db";

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

export async function getActivePeriod(userId: string) {
  const res = await query(
    `SELECT id, start_date::text, end_date::text
     FROM app.ozel_gun_periods
     WHERE user_id = $1 AND end_date IS NULL
     ORDER BY start_date DESC
     LIMIT 1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

export async function startPeriod(userId: string) {
  const existing = await getActivePeriod(userId);
  if (existing) return existing;

  const res = await query(
    `INSERT INTO app.ozel_gun_periods (user_id, start_date)
     VALUES ($1, $2)
     RETURNING id, start_date::text, end_date::text`,
    [userId, todayStr()],
  );
  return res.rows[0];
}

export async function endPeriod(userId: string) {
  const res = await query(
    `UPDATE app.ozel_gun_periods
     SET end_date = $2
     WHERE user_id = $1 AND end_date IS NULL
     RETURNING id, start_date::text, end_date::text`,
    [userId, todayStr()],
  );
  return res.rows[0] ?? null;
}

// Returns the set of YYYY-MM-DD strings that fall inside any period for this user.
// Fetches periods within the last 120 days to keep the query fast.
export async function getOzelGunDatesForUser(userId: string): Promise<Set<string>> {
  const res = await query(
    `SELECT start_date::text AS start, COALESCE(end_date, CURRENT_DATE)::text AS end
     FROM app.ozel_gun_periods
     WHERE user_id = $1
       AND start_date >= CURRENT_DATE - INTERVAL '120 days'`,
    [userId],
  );

  const dates = new Set<string>();
  for (const row of res.rows) {
    const cur = new Date(row.start + "T12:00:00+03:00");
    const end = new Date(row.end + "T12:00:00+03:00");
    while (cur <= end) {
      dates.add(cur.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return dates;
}
