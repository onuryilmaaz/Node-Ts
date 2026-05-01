import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Creating kaza_counters table and triggers...");
    
    // 1. Sayaç Tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS app.kaza_counters (
          user_id UUID PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
          fajr_count INT DEFAULT 0,
          dhuhr_count INT DEFAULT 0,
          asr_count INT DEFAULT 0,
          maghrib_count INT DEFAULT 0,
          isha_count INT DEFAULT 0,
          total_completed INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Mevcut verileri sayaca yansıtma (Senkronizasyon)
    await client.query(`
      INSERT INTO app.kaza_counters (user_id, fajr_count, dhuhr_count, asr_count, maghrib_count, isha_count, total_completed)
      SELECT 
          user_id,
          COUNT(*) FILTER (WHERE prayer_time = 'fajr' AND completed_at IS NULL) as fajr_count,
          COUNT(*) FILTER (WHERE prayer_time = 'dhuhr' AND completed_at IS NULL) as dhuhr_count,
          COUNT(*) FILTER (WHERE prayer_time = 'asr' AND completed_at IS NULL) as asr_count,
          COUNT(*) FILTER (WHERE prayer_time = 'maghrib' AND completed_at IS NULL) as maghrib_count,
          COUNT(*) FILTER (WHERE prayer_time = 'isha' AND completed_at IS NULL) as isha_count,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as total_completed
      FROM app.kaza_queue
      GROUP BY user_id
      ON CONFLICT (user_id) DO UPDATE SET
          fajr_count = EXCLUDED.fajr_count,
          dhuhr_count = EXCLUDED.dhuhr_count,
          asr_count = EXCLUDED.asr_count,
          maghrib_count = EXCLUDED.maghrib_count,
          isha_count = EXCLUDED.isha_count,
          total_completed = EXCLUDED.total_completed,
          updated_at = NOW();
    `);

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
