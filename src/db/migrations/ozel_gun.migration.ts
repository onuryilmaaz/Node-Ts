import { query } from "../index";

export async function runOzelGunMigration() {
  await query(`
    ALTER TABLE app.users
    ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('erkek', 'kadin'))
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.ozel_gun_periods (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      start_date  DATE NOT NULL,
      end_date    DATE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ozel_gun_periods_user_start
    ON app.ozel_gun_periods(user_id, start_date)
  `);
}
