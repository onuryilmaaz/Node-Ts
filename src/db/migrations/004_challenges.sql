-- Challenge sistemi tabloları
CREATE TABLE IF NOT EXISTS app.challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(120) NOT NULL,
  description  TEXT NOT NULL,
  type         VARCHAR(30) NOT NULL DEFAULT 'weekly',     -- 'weekly' | 'monthly' | 'special'
  goal_type    VARCHAR(30) NOT NULL,                       -- 'streak' | 'prayer_count' | 'prayer_time' | 'kaza_complete'
  goal_value   INTEGER NOT NULL,
  goal_prayer  VARCHAR(20),                                -- NULL = tüm vakitler, 'fajr' gibi
  bonus_points INTEGER NOT NULL DEFAULT 50,
  badge_id     VARCHAR(50),                                -- tamamlanınca verilecek rozet (opsiyonel)
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.user_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES app.challenges(id) ON DELETE CASCADE,
  progress      INTEGER NOT NULL DEFAULT 0,
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON app.challenges(is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_user_challenges_user ON app.user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_challenge ON app.user_challenges(challenge_id);

-- Örnek challenge'lar
INSERT INTO app.challenges (title, description, type, goal_type, goal_value, bonus_points, starts_at, ends_at)
VALUES
  (
    'Haftalık Seri',
    'Bu hafta her gün en az bir namaz kıl.',
    'weekly',
    'prayer_count',
    7,
    100,
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul'),
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul') + INTERVAL '7 days'
  ),
  (
    '5 Vakit Şampiyonu',
    'Bu hafta 5 gün boyunca tüm 5 vakti kıl.',
    'weekly',
    'prayer_count',
    25,
    200,
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul'),
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul') + INTERVAL '7 days'
  ),
  (
    'Sabah Yolcusu',
    'Bu hafta her gün sabah namazını kıl.',
    'weekly',
    'prayer_time',
    7,
    150,
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul'),
    date_trunc('week', NOW() AT TIME ZONE 'Europe/Istanbul') + INTERVAL '7 days'
  )
ON CONFLICT DO NOTHING;
