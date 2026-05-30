import { db } from "../../db";

const VALID_ACTIVITIES = ["quran", "dhikr", "nafile", "fasting", "dua", "memorization"];

export async function getGoals(userId: string) {
  const result = await db.execute(
    `SELECT id, activity_type, target, enabled, updated_at
     FROM app.user_goals
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
}

export async function upsertGoal(
  userId: string,
  activityType: string,
  target: number,
  enabled: boolean
) {
  if (!VALID_ACTIVITIES.includes(activityType)) {
    throw new Error("Geçersiz aktivite türü");
  }
  const result = await db.execute(
    `INSERT INTO app.user_goals (user_id, activity_type, target, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, activity_type)
     DO UPDATE SET target = $3, enabled = $4, updated_at = NOW()
     RETURNING *`,
    [userId, activityType, target, enabled]
  );
  return result.rows[0];
}

export async function deleteGoal(userId: string, activityType: string) {
  await db.execute(
    `DELETE FROM app.user_goals WHERE user_id = $1 AND activity_type = $2`,
    [userId, activityType]
  );
}
