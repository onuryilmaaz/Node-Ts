-- Kaza namaz kuyruğu tablosu
CREATE TABLE IF NOT EXISTS app.kaza_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  prayer_time  VARCHAR(20) NOT NULL,
  missed_date  DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kaza_queue_user_id ON app.kaza_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_kaza_queue_pending ON app.kaza_queue(user_id, completed_at) WHERE completed_at IS NULL;

-- Rozet detayları için icon ve color kolonları (opsiyonel, service'te tutuyoruz)
-- Sadece badge_id, user_id, earned_at yeterli

-- user_stats tablosuna updated_at varsa skip
ALTER TABLE app.user_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
