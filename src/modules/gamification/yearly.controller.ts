import type { Request, Response } from "express";
import { db } from "../../db";

const PRAYER_TR: Record<string, string> = {
  fajr: "Sabah",
  dhuhr: "Öğle",
  asr: "İkindi",
  maghrib: "Akşam",
  isha: "Yatsı",
};

const MONTH_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export async function getYearlyWrap(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const year = Math.max(2024, Math.min(2100, Number(req.query.year) || new Date().getFullYear()));
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const safe = <T,>(p: Promise<T>): Promise<T | { rows: any[] }> =>
      p.catch(() => ({ rows: [] }) as any);

    const [
      prayerTotals,
      prayerByMonth,
      prayerByTime,
      prayerByWeekday,
      streakRow,
      trackerTotals,
      hifzCount,
      kazaCompleted,
    ] = await Promise.all([
      // Toplam namaz + kaza + aktif gün
      safe(db.execute(
        `SELECT
           COUNT(*) FILTER (WHERE is_kaza = false) AS total_prayers,
           COUNT(*) FILTER (WHERE is_kaza = true) AS total_kaza,
           COUNT(DISTINCT date) AS active_days
         FROM app.prayer_logs
         WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [userId, yearStart, yearEnd],
      )),
      // En aktif ay
      safe(db.execute(
        `SELECT EXTRACT(MONTH FROM date)::int AS month, COUNT(*) AS cnt
         FROM app.prayer_logs
         WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND is_kaza = false
         GROUP BY month
         ORDER BY cnt DESC
         LIMIT 1`,
        [userId, yearStart, yearEnd],
      )),
      // Vakit dağılımı
      safe(db.execute(
        `SELECT prayer_time, COUNT(*) AS cnt
         FROM app.prayer_logs
         WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND is_kaza = false
           AND prayer_time != 'sunrise'
         GROUP BY prayer_time
         ORDER BY cnt DESC`,
        [userId, yearStart, yearEnd],
      )),
      // En aktif hafta günü (0=Sun..6=Sat)
      safe(db.execute(
        `SELECT EXTRACT(DOW FROM date)::int AS dow, COUNT(*) AS cnt
         FROM app.prayer_logs
         WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND is_kaza = false
         GROUP BY dow
         ORDER BY cnt DESC
         LIMIT 1`,
        [userId, yearStart, yearEnd],
      )),
      // En uzun streak (current+highest)
      safe(db.execute(
        `SELECT highest_streak, total_points
         FROM app.user_stats
         WHERE user_id = $1`,
        [userId],
      )),
      // Tracker toplamları (Kuran sayfası, zikir adedi, oruç günü, sadaka, dua dakikası, ezber ayet)
      safe(db.execute(
        `SELECT
           activity_type,
           value
         FROM app.tracker_logs
         WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [userId, yearStart, yearEnd],
      )),
      // Hıfz edilen sure sayısı (yıla bağlı değil — toplam)
      safe(db.execute(
        `SELECT COUNT(*) AS cnt FROM app.user_hifz
         WHERE user_id = $1 AND status = 'memorized'`,
        [userId],
      )),
      // Bu yıl tamamlanan kaza sayısı
      safe(db.execute(
        `SELECT COUNT(*) AS cnt FROM app.kaza_queue
         WHERE user_id = $1
           AND completed_at IS NOT NULL
           AND completed_at BETWEEN $2 AND $3`,
        [userId, yearStart, yearEnd],
      )),
    ]);

    // ─── Aggregate tracker totals from raw rows (value JSONB shape varies per type) ─
    const tracker = { quran_pages: 0, dhikr_count: 0, fasting_days: 0, sadaka: 0, dua_minutes: 0, ayet_new: 0 };
    for (const row of (trackerTotals as any).rows) {
      const v = row.value || {};
      switch (row.activity_type) {
        case "quran":         tracker.quran_pages += Number(v.pages || 0); break;
        case "dhikr":         tracker.dhikr_count += Number(v.count || 0); break;
        case "fasting":       tracker.fasting_days += 1; break;
        case "sadaka":        tracker.sadaka += Number(v.amount || 0); break;
        case "dua":           tracker.dua_minutes += Number(v.minutes || 0); break;
        case "memorization":  tracker.ayet_new += Number(v.new_ayets || 0); break;
      }
    }

    const topMonthIdx = Number((prayerByMonth as any).rows[0]?.month);
    const topDow = Number((prayerByWeekday as any).rows[0]?.dow);
    const turkishDow = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    return res.json({
      success: true,
      data: {
        year,
        prayers: {
          total: Number((prayerTotals as any).rows[0]?.total_prayers ?? 0),
          kaza:  Number((prayerTotals as any).rows[0]?.total_kaza ?? 0),
          active_days: Number((prayerTotals as any).rows[0]?.active_days ?? 0),
          top_month: topMonthIdx ? { index: topMonthIdx, name: MONTH_TR[topMonthIdx - 1], count: Number((prayerByMonth as any).rows[0]?.cnt ?? 0) } : null,
          top_weekday: !Number.isNaN(topDow) ? { dow: topDow, name: turkishDow[topDow], count: Number((prayerByWeekday as any).rows[0]?.cnt ?? 0) } : null,
          by_time: (prayerByTime as any).rows.map((r: any) => ({
            prayer_time: r.prayer_time,
            label: PRAYER_TR[r.prayer_time] ?? r.prayer_time,
            count: Number(r.cnt),
          })),
        },
        streaks: {
          highest: Number((streakRow as any).rows[0]?.highest_streak ?? 0),
          total_points: Number((streakRow as any).rows[0]?.total_points ?? 0),
        },
        tracker,
        hifz: {
          memorized_surahs: Number((hifzCount as any).rows[0]?.cnt ?? 0),
        },
        kaza_completed: Number((kazaCompleted as any).rows[0]?.cnt ?? 0),
      },
    });
  } catch (err) {
    console.error("Yearly wrap error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
