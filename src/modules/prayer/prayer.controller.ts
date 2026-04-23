import type { Request, Response } from "express";
import type { PrayerDailyQuery } from "./prayer.schema";
import { CITIES_TR } from "../../constants/cities.tr";
import { getDailyPrayerTimes } from "./prayer.service";
import { getNextPrayer } from "./prayer.utils";
import { toTRTimeString } from "../../utils/timezone";
import { db } from "../../db";


export async function getDailyPrayer(
  req: Request<{}, {}, {}, PrayerDailyQuery>,
  res: Response
) {
  try {
    const city = req.query.city?.toLowerCase();

    if (!city || !CITIES_TR[city]) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir şehir giriniz",
      });
    }

    const { lat, lng } = CITIES_TR[city];

    const prayers = await getDailyPrayerTimes(lat, lng);
    const nextPrayer = getNextPrayer(prayers);

    return res.json({
      success: true,
      data: {
        city,
        date: new Date().toISOString().split("T")[0],
        prayers: {
          sabah: toTRTimeString(prayers.fajr),
          imsak: toTRTimeString(prayers.sunrise),
          öğle: toTRTimeString(prayers.dhuhr),
          ikindi: toTRTimeString(prayers.asr),
          akşam: toTRTimeString(prayers.maghrib),
          yatsı: toTRTimeString(prayers.isha),
        },
        nextPrayer: nextPrayer
          ? {
              name: nextPrayer.name,
              time: toTRTimeString(nextPrayer.time),
              remaining: nextPrayer.remaining,
            }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Namaz vakitleri hesaplanamadı",
    });
  }
}

export async function trackPrayer(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { prayer_time, is_kaza } = req.body;
    if (!prayer_time) return res.status(400).json({ success: false, message: "prayer_time is required" });

    const validPrayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
    if (!validPrayers.includes(prayer_time)) {
      return res.status(400).json({ success: false, message: "Geçersiz namaz vakti" });
    }

    // Bugünü Türkiye saatine göre bul
    const nowTR = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
    const targetDateStr = nowTR.toISOString().split("T")[0];

    // Daha önce kaydedilmiş mi?
    const existing = await db.execute(
      `SELECT id FROM app.prayer_logs WHERE user_id = $1 AND date = $2 AND prayer_time = $3`,
      [userId, targetDateStr, prayer_time]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu namazı zaten kaydettiniz." });
    }

    const points = 10;
    await db.execute(
      `INSERT INTO app.prayer_logs (user_id, date, prayer_time, points_earned, is_kaza) VALUES ($1, $2, $3, $4, $5)`,
      [userId, targetDateStr, prayer_time, points, !!is_kaza]
    );

    // Update Gamification Stats
    const { updateStatsForPrayer } = await import("../gamification/gamification.service.js"); // lazy load or regular import
    const { stats, newBadges } = await updateStatsForPrayer(userId, nowTR, points);

    return res.json({
      success: true,
      message: "Namaz başarıyla kaydedildi",
      data: {
        pointsEarned: points,
        stats,
        newBadges
      }
    });

  } catch (err) {
    console.error("Prayer track error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
