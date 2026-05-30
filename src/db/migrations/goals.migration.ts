import { query } from "../index";

export async function runGoalsMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS app.user_goals (
      id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id       UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      activity_type VARCHAR(50) NOT NULL,
      target        INTEGER NOT NULL DEFAULT 10,
      enabled       BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, activity_type)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_goals_user
    ON app.user_goals(user_id)
  `);
}
