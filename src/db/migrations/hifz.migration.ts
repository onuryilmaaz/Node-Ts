import { query } from "../index";

export async function runHifzMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS app.user_hifz (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      surah_id    INTEGER NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress | memorized | reviewing
      pages_done  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, surah_id)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_hifz_user
    ON app.user_hifz(user_id)
  `);
}
