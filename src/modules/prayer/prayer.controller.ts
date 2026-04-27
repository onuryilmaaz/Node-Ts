import type { Request, Response } from "express";
import { db } from "../../db";

// ─────────────────────────────────────────────
// TRACK TODAY'S PRAYER
// ─────────────────────────────────────────────
export async function trackPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time, is_kaza } = req.body;
    if (!prayer_time)
      return res.status(400).json({ success: false, message: "prayer_time is required" });

    const validPrayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    if (!validPrayers.includes(prayer_time)) {
      return res.status(400).json({ success: false, message: "Geçersiz namaz vakti" });
    }

    const nowTR = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
    );
    const targetDateStr = nowTR.toISOString().split("T")[0];

    const existing = await db.execute(
      `SELECT id FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, targetDateStr, prayer_time],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu namazı zaten kaydettiniz." });
    }

    const points = 10;
    await db.execute(
      `INSERT INTO app.prayer_logs (user_id, date, prayer_time, points_earned, is_kaza) VALUES ($1, $2, $3, $4, $5)`,
      [userId, targetDateStr, prayer_time, points, !!is_kaza],
    );

    // Update Gamification Stats
    const { updateStatsForPrayer } =
      await import("../gamification/gamification.service.js");
    const { stats, newBadges } = await updateStatsForPrayer(userId, nowTR, points);

    // Update Challenge Progress
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
      },
    });
  } catch (err) {
    console.error("Prayer track error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────
// UNTRACK (DELETE) TODAY'S PRAYER
// ─────────────────────────────────────────────
export async function untrackPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time } = req.body;
    if (!prayer_time)
      return res.status(400).json({ success: false, message: "prayer_time is required" });

    const nowTR = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const todayStr = nowTR.toISOString().split("T")[0];

    const existing = await db.execute(
      `SELECT id, points_earned FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, todayStr, prayer_time]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Bu namaz kaydı bulunamadı." });
    }

    const points = Number(existing.rows[0].points_earned);

    await db.execute(
      `DELETE FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, todayStr, prayer_time]
    );

    // Puanı geri al
    await db.execute(
      `UPDATE app.user_stats SET total_points = GREATEST(0, total_points - $1), updated_at = NOW() WHERE user_id = $2`,
      [points, userId]
    );

    return res.json({ success: true, message: "Namaz kaydı silindi." });
  } catch (err) {
    console.error("Untrack prayer error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────
// KAZA QUEUE
// ─────────────────────────────────────────────
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
           WHEN 'fajr' THEN 1 WHEN 'sunrise' THEN 2 WHEN 'dhuhr' THEN 3 
           WHEN 'asr' THEN 4 WHEN 'maghrib' THEN 5 WHEN 'isha' THEN 6 ELSE 7 
         END`,
      [userId]
    );

    const completedRes = await db.execute(
      `SELECT COUNT(*) as cnt FROM app.kaza_queue WHERE user_id = $1 AND completed_at IS NOT NULL`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        pending: result.rows,
        total_pending: result.rows.length,
        total_completed: Number(completedRes.rows[0].cnt),
      }
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

    const validPrayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    if (!prayer_time || !validPrayers.includes(prayer_time)) {
      return res.status(400).json({ success: false, message: "Geçersiz namaz vakti" });
    }

    if (!missed_date) {
      return res.status(400).json({ success: false, message: "missed_date zorunlu" });
    }

    // Aynı gün aynı vakit zaten eklenmiş mi?
    const existing = await db.execute(
      `SELECT id FROM app.kaza_queue WHERE user_id = $1 AND prayer_time = $2 AND missed_date = $3 AND completed_at IS NULL`,
      [userId, prayer_time, missed_date]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu kaza namazı zaten listede." });
    }

    const result = await db.execute(
      `INSERT INTO app.kaza_queue (user_id, prayer_time, missed_date) VALUES ($1, $2, $3) RETURNING *`,
      [userId, prayer_time, missed_date]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
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
      `SELECT id FROM app.kaza_queue WHERE id = $1 AND user_id = $2 AND completed_at IS NULL`,
      [id, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Kaza namazı bulunamadı." });
    }

    await db.execute(
      `UPDATE app.kaza_queue SET completed_at = NOW() WHERE id = $1`,
      [id]
    );

    // Kaza için de puan ver (yarım puan = 5)
    const points = 5;
    await db.execute(
      `UPDATE app.user_stats SET total_points = total_points + $1, updated_at = NOW() WHERE user_id = $2`,
      [points, userId]
    );

    return res.json({ success: true, message: "Kaza namazı tamamlandı.", pointsEarned: points });
  } catch (err) {
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

    await db.execute(
      `DELETE FROM app.kaza_queue WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return res.json({ success: true, message: "Kaza namazı silindi." });
  } catch (err) {
    console.error("Delete kaza error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────
// WEEKLY PRAYER HISTORY
// ─────────────────────────────────────────────
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
      [userId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Prayer history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
