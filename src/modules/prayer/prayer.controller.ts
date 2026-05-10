import type { Request, Response } from "express";
import { db } from "../../db";

export async function trackPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time, is_kaza } = req.body;
    if (!prayer_time)
      return res
        .status(400)
        .json({ success: false, message: "prayer_time is required" });

    const validPrayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    if (!validPrayers.includes(prayer_time)) {
      return res
        .status(400)
        .json({ success: false, message: "Geçersiz namaz vakti" });
    }

    const targetDateStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Istanbul",
    });

    const existing = await db.execute(
      `SELECT id FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, targetDateStr, prayer_time],
    );

    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Bu namazı zaten kaydettiniz." });
    }

    const points = 10;
    await db.execute(
      `INSERT INTO app.prayer_logs (user_id, date, prayer_time, points_earned, is_kaza) VALUES ($1, $2, $3, $4, $5)`,
      [userId, targetDateStr, prayer_time, points, !!is_kaza],
    );

    const { updateStatsForPrayer } =
      await import("../gamification/gamification.service.js");
    const { stats, newBadges, streakIncremented } = await updateStatsForPrayer(
      userId,
      targetDateStr,
      points,
    );

    const { updateChallengeProgress } =
      await import("../challenge/challenge.service.js");
    const completedChallenges = await updateChallengeProgress(userId);

    return res.json({
      success: true,
      message: "Namaz başarıyla kaydedildi",
      data: {
        pointsEarned: points,
        stats,
        newBadges,
        completedChallenges,
        streakIncremented,
      },
    });
  } catch (err) {
    console.error("Prayer track error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function untrackPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time } = req.body;
    if (!prayer_time)
      return res
        .status(400)
        .json({ success: false, message: "prayer_time is required" });

    const nowTR = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
    );
    const todayStr = nowTR.toISOString().split("T")[0];

    const existing = await db.execute(
      `SELECT id, points_earned FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, todayStr, prayer_time],
    );

    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Bu namaz kaydı bulunamadı." });
    }

    const points = Number(existing.rows[0].points_earned);

    await db.execute(
      `DELETE FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, todayStr, prayer_time],
    );

    await db.execute(
      `UPDATE app.user_stats SET total_points = GREATEST(0, total_points - $1), updated_at = NOW() WHERE user_id = $2`,
      [points, userId],
    );

    return res.json({ success: true, message: "Namaz kaydı silindi." });
  } catch (err) {
    console.error("Untrack prayer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getKazaList(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await db.execute(
      `SELECT id, prayer_time, missed_date, created_at
       FROM app.kaza_queue
       WHERE user_id = $1 AND completed_at IS NULL
       ORDER BY missed_date ASC, 
         CASE prayer_time 
           WHEN 'fajr' THEN 1 WHEN 'dhuhr' THEN 2 
           WHEN 'asr' THEN 3 WHEN 'maghrib' THEN 4 WHEN 'isha' THEN 5 ELSE 6 
         END
       LIMIT 50`,
      [userId],
    );

    const statsRes = await db.execute(
      `SELECT * FROM app.kaza_counters WHERE user_id = $1`,
      [userId],
    );

    let stats = statsRes.rows[0];
    if (!stats) {
      const createRes = await db.execute(
        `INSERT INTO app.kaza_counters (user_id) VALUES ($1) RETURNING *`,
        [userId],
      );
      stats = createRes.rows[0];
    }

    const velocityRes = await db.execute(
      `SELECT COUNT(*) as cnt FROM app.kaza_queue 
       WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    );
    const completedLast30Days = Number(velocityRes.rows[0].cnt);

    return res.json({
      success: true,
      data: {
        pending: result.rows,
        total_pending:
          stats.fajr_count +
          stats.dhuhr_count +
          stats.asr_count +
          stats.maghrib_count +
          stats.isha_count,
        total_completed: Number(stats.total_completed),
        completed_last_30_days: completedLast30Days,
        counters: {
          fajr: stats.fajr_count,
          dhuhr: stats.dhuhr_count,
          asr: stats.asr_count,
          maghrib: stats.maghrib_count,
          isha: stats.isha_count,
        },
      },
    });
  } catch (err) {
    console.error("Kaza list error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function addKazaPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time, missed_date } = req.body;

    const validPrayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    if (!prayer_time || !validPrayers.includes(prayer_time)) {
      return res
        .status(400)
        .json({ success: false, message: "Geçersiz namaz vakti" });
    }

    if (!missed_date) {
      return res
        .status(400)
        .json({ success: false, message: "missed_date zorunlu" });
    }

    const existing = await db.execute(
      `SELECT id FROM app.kaza_queue WHERE user_id = $1 AND prayer_time = $2 AND missed_date = $3 AND completed_at IS NULL`,
      [userId, prayer_time, missed_date],
    );
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Bu kaza namazı zaten listede." });
    }

    await db.execute("BEGIN");

    const result = await db.execute(
      `INSERT INTO app.kaza_queue (user_id, prayer_time, missed_date) VALUES ($1, $2, $3) RETURNING *`,
      [userId, prayer_time, missed_date],
    );

    const counterField = `${prayer_time}_count`;
    await db.execute(
      `INSERT INTO app.kaza_counters (user_id, ${counterField}) 
       VALUES ($1, 1) 
       ON CONFLICT (user_id) DO UPDATE SET ${counterField} = app.kaza_counters.${counterField} + 1, updated_at = NOW()`,
      [userId],
    );

    await db.execute("COMMIT");

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    await db.execute("ROLLBACK");
    console.error("Add kaza error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function completeKazaPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id, prayer_time FROM app.kaza_queue WHERE id = $1 AND user_id = $2 AND completed_at IS NULL`,
      [id, userId],
    );
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Kaza namazı bulunamadı." });
    }

    const prayer_time = existing.rows[0].prayer_time;

    await db.execute("BEGIN");

    await db.execute(
      `UPDATE app.kaza_queue SET completed_at = NOW() WHERE id = $1`,
      [id],
    );

    const counterField = `${prayer_time}_count`;
    await db.execute(
      `UPDATE app.kaza_counters SET 
       ${counterField} = GREATEST(0, ${counterField} - 1), 
       total_completed = total_completed + 1,
       updated_at = NOW() 
       WHERE user_id = $1`,
      [userId],
    );

    const points = 5;
    await db.execute(
      `UPDATE app.user_stats SET total_points = total_points + $1, updated_at = NOW() WHERE user_id = $2`,
      [points, userId],
    );

    await db.execute("COMMIT");

    return res.json({
      success: true,
      message: "Kaza namazı tamamlandı.",
      pointsEarned: points,
    });
  } catch (err) {
    await db.execute("ROLLBACK");
    console.error("Complete kaza error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteKazaPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id, prayer_time FROM app.kaza_queue WHERE id = $1 AND user_id = $2 AND completed_at IS NULL`,
      [id, userId],
    );
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Kaza namazı bulunamadı." });
    }

    const prayer_time = existing.rows[0].prayer_time;

    await db.execute("BEGIN");

    await db.execute(
      `DELETE FROM app.kaza_queue WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    const counterField = `${prayer_time}_count`;
    await db.execute(
      `UPDATE app.kaza_counters SET 
       ${counterField} = GREATEST(0, ${counterField} - 1), 
       updated_at = NOW() 
       WHERE user_id = $1`,
      [userId],
    );

    await db.execute("COMMIT");

    return res.json({ success: true, message: "Kaza namazı silindi." });
  } catch (err) {
    await db.execute("ROLLBACK");
    console.error("Delete kaza error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function batchAddKaza(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { prayers, count } = req.body;

    if (!userId || !prayers || !count)
      return res.status(400).json({ success: false, message: "Geçersiz veri" });

    await db.execute("BEGIN");

    for (const prayer of prayers) {
      const counterField = `${prayer}_count`;
      await db.execute(
        `INSERT INTO app.kaza_counters (user_id, ${counterField}) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id) DO UPDATE SET ${counterField} = app.kaza_counters.${counterField} + $2, updated_at = NOW()`,
        [userId, count],
      );
    }

    await db.execute("COMMIT");

    return res.json({ success: true, message: "Toplu kaza ekleme başarılı." });
  } catch (err) {
    await db.execute("ROLLBACK");
    console.error("Batch add kaza error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function quickDecrementKaza(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time } = req.body;
    const validPrayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

    if (!validPrayers.includes(prayer_time)) {
      return res
        .status(400)
        .json({ success: false, message: "Geçersiz namaz vakti" });
    }

    await db.execute("BEGIN");

    const oldest = await db.execute(
      `SELECT id FROM app.kaza_queue 
       WHERE user_id = $1 AND prayer_time = $2 AND completed_at IS NULL 
       ORDER BY missed_date ASC, created_at ASC LIMIT 1`,
      [userId, prayer_time],
    );

    if (oldest.rows.length === 0) {
      const counterField = `${prayer_time}_count`;

      const checkRes = await db.execute(
        `SELECT ${counterField} FROM app.kaza_counters WHERE user_id = $1`,
        [userId],
      );
      const currentCount = checkRes.rows[0]?.[counterField] || 0;

      if (currentCount <= 0) {
        return res
          .status(404)
          .json({ success: false, message: "Bekleyen kaza bulunamadı." });
      }

      await db.execute("BEGIN");
      await db.execute(
        `UPDATE app.kaza_counters 
         SET ${counterField} = GREATEST(0, ${counterField} - 1), 
             total_completed = total_completed + 1,
             updated_at = NOW() 
         WHERE user_id = $1`,
        [userId],
      );

      await db.execute(
        `INSERT INTO app.kaza_queue (user_id, prayer_time, missed_date, completed_at) 
         VALUES ($1, $2, NOW(), NOW())`,
        [userId, prayer_time],
      );

      await db.execute("COMMIT");
      return res.json({ success: true, points: 5 });
    }

    const id = oldest.rows[0].id;
    await db.execute(
      `UPDATE app.kaza_queue SET completed_at = NOW() WHERE id = $1`,
      [id],
    );

    const counterField = `${prayer_time}_count`;
    await db.execute(
      `UPDATE app.kaza_counters SET 
       ${counterField} = GREATEST(0, ${counterField} - 1), 
       total_completed = total_completed + 1,
       updated_at = NOW() 
       WHERE user_id = $1`,
      [userId],
    );

    const points = 5;
    await db.execute(
      `UPDATE app.user_stats SET total_points = total_points + $1, updated_at = NOW() WHERE user_id = $2`,
      [points, userId],
    );

    await db.execute("COMMIT");

    return res.json({ success: true, pointsEarned: points });
  } catch (err) {
    await db.execute("ROLLBACK");
    console.error("Quick decrement error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getPrayerHistory(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const days = Math.min(Number(req.query.days) || 7, 90);

    const result = await db.execute(
      `SELECT date, prayer_time, is_kaza, points_earned
       FROM app.prayer_logs
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '${days} days'
       ORDER BY date DESC, 
         CASE prayer_time 
           WHEN 'fajr' THEN 1 WHEN 'sunrise' THEN 2 WHEN 'dhuhr' THEN 3 
           WHEN 'asr' THEN 4 WHEN 'maghrib' THEN 5 WHEN 'isha' THEN 6 ELSE 7 
         END`,
      [userId],
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Prayer history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
