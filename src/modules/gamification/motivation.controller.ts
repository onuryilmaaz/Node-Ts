import type { Request, Response } from "express";
import {
  getUserStats,
  getWeeklyStats,
  islamicDateStr,
} from "./gamification.service";
import {
  generateMotivation,
  generateStatsInsight,
  generateYearlyNarrative,
  aiEnabled,
  type MotivationContext,
} from "../../services/ai.service";

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

// Günlük cache: aynı kullanıcı için aynı gün tekrar API çağrısı yapma.
// { message, source } değerini userId+islamiTarih anahtarıyla tutar.
const cache = new Map<string, { message: string; source: string }>();

/** Son 7 gündeki vakit dağılımından en çok kaçırılan vakti bulur. */
function findMostMissed(
  byPrayerTime: any[]
): string | null {
  const counts: Record<string, number> = {};
  for (const p of PRAYERS) counts[p] = 0;
  for (const row of byPrayerTime) {
    if (row.prayer_time in counts) counts[row.prayer_time] = Number(row.total);
  }
  let min: string | null = null;
  let minVal = Infinity;
  for (const p of PRAYERS) {
    const c = counts[p] ?? 0;
    if (c < minVal) {
      minVal = c;
      min = p;
    }
  }
  // Hepsi tamsa (her vakit en az 1) "en çok kaçırılan" anlamlı değil.
  return minVal >= 7 ? null : min;
}

const PRAYER_TR: Record<string, string> = {
  fajr: "sabah",
  dhuhr: "öğle",
  asr: "ikindi",
  maghrib: "akşam",
  isha: "yatsı",
};

/** AI yokken/başarısızken kullanılan bağlama duyarlı statik mesaj. */
function fallbackMessage(ctx: MotivationContext): string {
  if (ctx.todayPrayerCount >= 5) {
    return "Bugünün beş vaktini tamamladın, Allah kabul etsin. Bu istikrar çok değerli.";
  }
  if (ctx.currentStreak >= 7) {
    return `${ctx.currentStreak} günlük serini sürdürüyorsun, maşallah. Bugün de devam ettir.`;
  }
  if (ctx.mostMissedPrayer) {
    const tr = PRAYER_TR[ctx.mostMissedPrayer] ?? ctx.mostMissedPrayer;
    return `Bu hafta en çok ${tr} namazını kaçırmışsın. Bugün ona biraz daha dikkat etmeye ne dersin?`;
  }
  return "Yeni bir gün, yeni bir fırsat. Bir sonraki vakitle güzel bir başlangıç yap.";
}

export async function getMotivation(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const cacheKey = `${userId}:${islamicDateStr()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const [stats, weekly] = await Promise.all([
      getUserStats(userId),
      getWeeklyStats(userId),
    ]);

    const ctx: MotivationContext = {
      currentStreak: Number(stats.current_streak) || 0,
      highestStreak: Number(stats.highest_streak) || 0,
      totalPoints: Number(stats.total_points) || 0,
      level: stats.level ?? null,
      todayPrayerCount: Array.isArray(stats.today_prayers)
        ? stats.today_prayers.length
        : 0,
      mostMissedPrayer: findMostMissed(weekly.byPrayerTime || []),
    };

    const aiMessage = await generateMotivation(ctx);
    const result = {
      message: aiMessage ?? fallbackMessage(ctx),
      source: aiMessage ? "ai" : aiEnabled ? "fallback" : "static",
    };

    // Sadece kalıcı sonuçları cache'le: başarılı AI mesajı veya AI tamamen
    // kapalıyken statik mesaj. AI etkin ama geçici hata aldıysa ("fallback")
    // cache'leme ki kota/model düzelince bir sonraki istekte AI'a dönsün.
    if (result.source !== "fallback") {
      cache.set(cacheKey, result);
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error generating motivation:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Haftalık AI içgörüsü — GET /gamification/insight
// ─────────────────────────────────────────────────────────────────────────

const insightCache = new Map<string, { message: string; source: string }>();

export async function getInsight(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!aiEnabled) {
      return res.json({ success: true, data: null }); // AI kapalıysa kart gösterme
    }

    const cacheKey = `${userId}:${islamicDateStr()}`;
    const cached = insightCache.get(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const [stats, weekly] = await Promise.all([
      getUserStats(userId),
      getWeeklyStats(userId),
    ]);

    const weeklyPrayerCounts = (weekly.daily || []).map((d: any) =>
      Number(d.prayer_count)
    );
    const byPrayerTime = (weekly.byPrayerTime || []).map((p: any) => ({
      prayer_time: String(p.prayer_time),
      total: Number(p.total),
    }));

    const message = await generateStatsInsight({
      currentStreak: Number(stats.current_streak) || 0,
      weeklyPrayerCounts,
      byPrayerTime,
    });

    if (!message) return res.json({ success: true, data: null });

    const result = { message, source: "ai" };
    insightCache.set(cacheKey, result);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error generating insight:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Yıllık özet anlatısı — POST /gamification/yearly-narrative
// İstemci, elindeki wrap verisini gönderir; tekrar DB sorgusu yapmayız.
// ─────────────────────────────────────────────────────────────────────────

export async function getYearlyNarrative(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!aiEnabled) return res.json({ success: true, data: null });

    const b = req.body ?? {};
    const message = await generateYearlyNarrative({
      year: Number(b.year) || new Date().getFullYear(),
      totalPrayers: Number(b.totalPrayers) || 0,
      activeDays: Number(b.activeDays) || 0,
      highestStreak: Number(b.highestStreak) || 0,
      topMonth: b.topMonth ?? null,
      quranPages: Number(b.quranPages) || 0,
      memorizedSurahs: Number(b.memorizedSurahs) || 0,
    });

    return res.json({ success: true, data: message ? { message } : null });
  } catch (err) {
    console.error("Error generating yearly narrative:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
