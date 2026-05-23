import { query } from "../index";

export async function runGroupsMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS app.groups (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      name         VARCHAR(100) NOT NULL,
      description  TEXT,
      avatar_url   TEXT,
      invite_code  VARCHAR(10) UNIQUE NOT NULL,
      max_members  INT DEFAULT 20,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.group_members (
      id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id  UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
      user_id   UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
      role      VARCHAR(15) DEFAULT 'member'
                  CHECK (role IN ('owner','moderator','member')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.group_activity_types (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id   UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
      name       VARCHAR(100) NOT NULL,
      base_type  VARCHAR(50),
      unit       VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.group_goals (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id         UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
      activity_type_id UUID REFERENCES app.group_activity_types(id) ON DELETE SET NULL,
      title            VARCHAR(200) NOT NULL,
      goal_type        VARCHAR(20) NOT NULL
                         CHECK (goal_type IN ('group_total','per_person','streak')),
      target_value     DECIMAL NOT NULL,
      start_date       DATE NOT NULL,
      end_date         DATE,
      status           VARCHAR(20) DEFAULT 'active'
                         CHECK (status IN ('draft','active','completed','cancelled')),
      created_by       UUID NOT NULL REFERENCES app.users(id),
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.group_goal_suggestions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id         UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
      suggested_by     UUID NOT NULL REFERENCES app.users(id),
      activity_type_id UUID REFERENCES app.group_activity_types(id) ON DELETE SET NULL,
      title            VARCHAR(200) NOT NULL,
      goal_type        VARCHAR(20) NOT NULL,
      target_value     DECIMAL NOT NULL,
      start_date       DATE,
      end_date         DATE,
      note             TEXT,
      status           VARCHAR(20) DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected')),
      reviewed_by      UUID REFERENCES app.users(id),
      reviewed_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS app.group_activity_logs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id         UUID NOT NULL REFERENCES app.groups(id) ON DELETE CASCADE,
      user_id          UUID NOT NULL REFERENCES app.users(id),
      goal_id          UUID REFERENCES app.group_goals(id) ON DELETE SET NULL,
      activity_type_id UUID NOT NULL REFERENCES app.group_activity_types(id) ON DELETE CASCADE,
      tracker_log_id   UUID,
      value            DECIMAL NOT NULL,
      points           INT NOT NULL DEFAULT 0,
      logged_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_group_members_user    ON app.group_members(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_group_members_group   ON app.group_members(group_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_group_act_logs_group  ON app.group_activity_logs(group_id, logged_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_group_act_logs_user   ON app.group_activity_logs(user_id, group_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_groups_invite_code    ON app.groups(invite_code)`);

  // avatar_public_id sütunu ekle (idempotent)
  await query(
    `ALTER TABLE app.groups ADD COLUMN IF NOT EXISTS avatar_public_id TEXT`,
  );

  // expo push token sütunu ekle (idempotent)
  await query(
    `ALTER TABLE app.users ADD COLUMN IF NOT EXISTS expo_push_token TEXT`,
  );

  // Mevcut gruplara eksik aktivite tiplerini ekle
  await query(`
    INSERT INTO app.group_activity_types (group_id, name, base_type, unit)
    SELECT g.id, t.name, t.base_type, t.unit
    FROM app.groups g
    CROSS JOIN (
      VALUES
        ('Kuran Okuma',  'quran',        'sayfa'),
        ('Zikir',        'dhikr',        'adet'),
        ('Nafile Namaz', 'nafile',       'rekât'),
        ('Oruç',         'fasting',      'gün'),
        ('Sadaka',       'sadaka',       'adet'),
        ('Dua',          'dua',          'dakika'),
        ('Hıfz',         'memorization', 'ayet')
    ) AS t(name, base_type, unit)
    WHERE NOT EXISTS (
      SELECT 1 FROM app.group_activity_types
      WHERE group_id = g.id AND base_type = t.base_type
    )
  `);
}
