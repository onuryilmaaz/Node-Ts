import { query } from "../index";

export async function runFamilyMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS app.child_profiles (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      name          VARCHAR(50) NOT NULL,
      birth_year    SMALLINT,
      avatar_emoji  VARCHAR(10) DEFAULT '🌙',
      pin_code      VARCHAR(100),
      gender        VARCHAR(10) CHECK (gender IN ('erkek','kız',NULL)),
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.child_stats (
      child_id        UUID PRIMARY KEY REFERENCES app.child_profiles(id) ON DELETE CASCADE,
      total_stars     INTEGER DEFAULT 0,
      current_streak  INTEGER DEFAULT 0,
      highest_streak  INTEGER DEFAULT 0,
      level           SMALLINT DEFAULT 1,
      last_activity   DATE,
      updated_at      TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.child_tasks (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id            UUID NOT NULL REFERENCES app.child_profiles(id) ON DELETE CASCADE,
      parent_id           UUID NOT NULL REFERENCES app.users(id),
      task_type           VARCHAR(30) NOT NULL
                            CHECK (task_type IN ('prayer','quran','dua','dhikr','wudu','memorization','manners','custom')),
      title               VARCHAR(100) NOT NULL,
      description         TEXT,
      recurrence          VARCHAR(10) DEFAULT 'daily'
                            CHECK (recurrence IN ('daily','weekly','once')),
      scheduled_days      INTEGER[],
      due_time            TIME,
      reward_stars        SMALLINT DEFAULT 1,
      requires_proof      BOOLEAN DEFAULT false,
      requires_approval   BOOLEAN DEFAULT false,
      is_active           BOOLEAN DEFAULT true,
      created_at          TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.child_task_completions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id          UUID NOT NULL REFERENCES app.child_tasks(id) ON DELETE CASCADE,
      child_id         UUID NOT NULL REFERENCES app.child_profiles(id) ON DELETE CASCADE,
      completion_date  DATE NOT NULL,
      completed_at     TIMESTAMPTZ DEFAULT now(),
      status           VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected')),
      evidence_url     TEXT,
      parent_note      TEXT,
      reviewed_at      TIMESTAMPTZ,
      stars_earned     SMALLINT DEFAULT 0,
      UNIQUE(task_id, completion_date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.child_badges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id    UUID NOT NULL REFERENCES app.child_profiles(id) ON DELETE CASCADE,
      badge_type  VARCHAR(50) NOT NULL,
      earned_at   TIMESTAMPTZ DEFAULT now(),
      UNIQUE(child_id, badge_type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.child_rewards (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      child_id     UUID NOT NULL REFERENCES app.child_profiles(id) ON DELETE CASCADE,
      title        VARCHAR(100) NOT NULL,
      cost_stars   SMALLINT NOT NULL,
      is_redeemed  BOOLEAN DEFAULT false,
      redeemed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_child_profiles_parent
    ON app.child_profiles(parent_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_child_tasks_child
    ON app.child_tasks(child_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_child_completions_child
    ON app.child_task_completions(child_id, completion_date DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_child_completions_task
    ON app.child_task_completions(task_id, completion_date DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_child_badges_child
    ON app.child_badges(child_id)`);
}
