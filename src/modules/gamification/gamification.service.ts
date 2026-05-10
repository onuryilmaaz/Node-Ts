import { db } from "../../db";

function turkeyDateStr(d?: Date): string {
  return (d ?? new Date()).toLocaleDateString("en-CA", {
    timeZone: "Europe/Istanbul",
  });
}

function safeLastDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") return val.substring(0, 10);
  return (val as Date).toLocaleDateString("en-CA", {
    timeZone: "Europe/Istanbul",
  });
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00+03:00");
  d.setDate(d.getDate() - 1);
  return turkeyDateStr(d);
}

async function calculateStreakFromLogs(
  userId: string,
): Promise<{ streak: number; lastDate: string | null }> {
  const res = await db.execute(
    `SELECT date::text AS d FROM app.prayer_logs
     WHERE user_id = $1
     GROUP BY date HAVING COUNT(*) >= 5
     ORDER BY date DESC LIMIT 100`,
    [userId],
  );
  if (res.rows.length === 0) return { streak: 0, lastDate: null };

  const completed = new Set(res.rows.map((r: any) => r.d.substring(0, 10)));
  const todayStr = turkeyDateStr();

  let current = completed.has(todayStr) ? todayStr : prevDay(todayStr);
  let streak = 0;
  let lastDate: string | null = null;

  for (let i = 0; i < 100; i++) {
    if (completed.has(current)) {
      if (!lastDate) lastDate = current;
      streak++;
      current = prevDay(current);
    } else {
      break;
    }
  }
  return { streak, lastDate };
}

export const BADGES = {
  // İlk adımlar
  FIRST_PRAYER: "ilk_adim",
  // Streak rozetleri
  STREAK_3: "seri_3_gun",
  STREAK_7: "seri_7_gun",
  STREAK_14: "seri_14_gun",
  STREAK_30: "seri_30_gun",
  STREAK_100: "seri_100_gun",
  // Puan rozetleri
  POINTS_100: "yuz_puan",
  POINTS_500: "bes_yuz_puan",
  POINTS_1000: "bin_puan",
  POINTS_5000: "bes_bin_puan",
  // Vakit rozetleri
  FAJR_MASTER: "sabah_ustasi",
  ALL_PRAYERS: "tum_vakit_ustasi",
  // Özel rozetler
  WEEK_PERFECT: "mukemmel_hafta",
  MONTH_PERFECT: "mukemmel_ay",
  EARLY_BIRD: "erken_kuş",
};

export const BADGE_DETAILS: Record<
  string,
  {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    category: string;
  }
> = {
  [BADGES.FIRST_PRAYER]: {
    id: BADGES.FIRST_PRAYER,
    name: "İlk Adım",
    description: "İlk namazını takip ettin!",
    icon: "footsteps",
    color: "#10b981",
    category: "başlangıç",
  },
  [BADGES.STREAK_3]: {
    id: BADGES.STREAK_3,
    name: "3 Günlük Seri",
    description: "3 gün üst üste namaz takibi!",
    icon: "flame",
    color: "#f59e0b",
    category: "seri",
  },
  [BADGES.STREAK_7]: {
    id: BADGES.STREAK_7,
    name: "Haftalık Seri",
    description: "7 gün üst üste! Harika gidiyorsun.",
    icon: "flame",
    color: "#f97316",
    category: "seri",
  },
  [BADGES.STREAK_14]: {
    id: BADGES.STREAK_14,
    name: "İki Haftalık Seri",
    description: "14 günlük muhteşem bir seri!",
    icon: "bonfire",
    color: "#ef4444",
    category: "seri",
  },
  [BADGES.STREAK_30]: {
    id: BADGES.STREAK_30,
    name: "Aylık Şampiyon",
    description: "30 gün eksiksiz! Sen bir efsanesin.",
    icon: "trophy",
    color: "#a855f7",
    category: "seri",
  },
  [BADGES.STREAK_100]: {
    id: BADGES.STREAK_100,
    name: "100 Günlük Efsane",
    description: "100 gün kesintisiz namaz. Maşallah!",
    icon: "medal",
    color: "#6366f1",
    category: "seri",
  },
  [BADGES.POINTS_100]: {
    id: BADGES.POINTS_100,
    name: "100 Puan",
    description: "100 puana ulaştın.",
    icon: "star",
    color: "#eab308",
    category: "puan",
  },
  [BADGES.POINTS_500]: {
    id: BADGES.POINTS_500,
    name: "500 Puan",
    description: "Maşallah! 500 puana ulaştın.",
    icon: "star",
    color: "#f59e0b",
    category: "puan",
  },
  [BADGES.POINTS_1000]: {
    id: BADGES.POINTS_1000,
    name: "1000 Puan",
    description: "Bin puan! Sen bir kahramansın.",
    icon: "diamond",
    color: "#3b82f6",
    category: "puan",
  },
  [BADGES.POINTS_5000]: {
    id: BADGES.POINTS_5000,
    name: "5000 Puan Ustası",
    description: "5000 puan! Eşsiz bir başarı.",
    icon: "diamond",
    color: "#8b5cf6",
    category: "puan",
  },
  [BADGES.FAJR_MASTER]: {
    id: BADGES.FAJR_MASTER,
    name: "Sabah Ustası",
    description: "7 gün sabah namazını kaçırmadın!",
    icon: "sunny",
    color: "#fbbf24",
    category: "vakit",
  },
  [BADGES.ALL_PRAYERS]: {
    id: BADGES.ALL_PRAYERS,
    name: "Tüm Vakit Ustası",
    description: "Bir günde tüm 5 vakti kıldın!",
    icon: "checkmark-circle",
    color: "#10b981",
    category: "vakit",
  },
  [BADGES.WEEK_PERFECT]: {
    id: BADGES.WEEK_PERFECT,
    name: "Mükemmel Hafta",
    description: "Bir haftada tüm namazları kıldın!",
    icon: "calendar",
    color: "#06b6d4",
    category: "özel",
  },
  [BADGES.MONTH_PERFECT]: {
    id: BADGES.MONTH_PERFECT,
    name: "Mükemmel Ay",
    description: "Bir ayda tüm namazları kıldın! Süphanallah!",
    icon: "planet",
    color: "#8b5cf6",
    category: "özel",
  },
  [BADGES.EARLY_BIRD]: {
    id: BADGES.EARLY_BIRD,
    name: "Erken Kuş",
    description: "Sabah namazını 14 gün hiç kaçırmadın!",
    icon: "partly-sunny",
    color: "#f59e0b",
    category: "özel",
  },
};

export const LEVELS = [
  {
    level: 1,
    name: "Başlangıç",
    minPoints: 0,
    maxPoints: 99,
    tier: "bronze",
    color: "#cd7f32",
    icon: "leaf",
  },
  {
    level: 2,
    name: "Mümin",
    minPoints: 100,
    maxPoints: 299,
    tier: "bronze",
    color: "#cd7f32",
    icon: "leaf",
  },
  {
    level: 3,
    name: "Salik",
    minPoints: 300,
    maxPoints: 599,
    tier: "silver",
    color: "#9ca3af",
    icon: "shield",
  },
  {
    level: 4,
    name: "Abid",
    minPoints: 600,
    maxPoints: 999,
    tier: "silver",
    color: "#9ca3af",
    icon: "shield",
  },
  {
    level: 5,
    name: "Zahid",
    minPoints: 1000,
    maxPoints: 1999,
    tier: "gold",
    color: "#fbbf24",
    icon: "star",
  },
  {
    level: 6,
    name: "Arif",
    minPoints: 2000,
    maxPoints: 3499,
    tier: "gold",
    color: "#fbbf24",
    icon: "star",
  },
  {
    level: 7,
    name: "Veli",
    minPoints: 3500,
    maxPoints: 4999,
    tier: "diamond",
    color: "#60a5fa",
    icon: "diamond",
  },
  {
    level: 8,
    name: "Muhlis",
    minPoints: 5000,
    maxPoints: 7499,
    tier: "diamond",
    color: "#60a5fa",
    icon: "diamond",
  },
  {
    level: 9,
    name: "Âşık",
    minPoints: 7500,
    maxPoints: 9999,
    tier: "legend",
    color: "#a855f7",
    icon: "planet",
  },
  {
    level: 10,
    name: "Efsane",
    minPoints: 10000,
    maxPoints: Infinity,
    tier: "legend",
    color: "#a855f7",
    icon: "planet",
  },
];

export function calculateLevel(totalPoints: number) {
  const lvl =
    LEVELS.slice()
      .reverse()
      .find((l) => totalPoints >= l.minPoints) ?? LEVELS[0]!;
  const nextLvl = LEVELS.find((l) => l.level === lvl!.level + 1);
  const progressInLevel = totalPoints - lvl!.minPoints;
  const levelRange = nextLvl ? nextLvl.minPoints - lvl!.minPoints : 1;
  const progressPercent = nextLvl
    ? Math.min(100, Math.round((progressInLevel / levelRange) * 100))
    : 100;
  return {
    ...lvl!,
    nextLevel: nextLvl || null,
    progressPercent,
    pointsToNextLevel: nextLvl ? nextLvl.minPoints - totalPoints : 0,
  };
}

export async function getUserStats(userId: string) {
  const result = await db.execute(
    `SELECT total_points, current_streak, highest_streak, last_prayer_date FROM app.user_stats WHERE user_id = $1`,
    [userId],
  );

  const todayStr = turkeyDateStr();
  const todayPrayersRes = await db.execute(
    `SELECT prayer_time, is_kaza FROM app.prayer_logs WHERE user_id = $1 AND date = $2`,
    [userId, todayStr],
  );

  const todayPrayers = todayPrayersRes.rows.map((r) => r.prayer_time);
  const kazaPrayers = todayPrayersRes.rows
    .filter((r) => r.is_kaza)
    .map((r) => r.prayer_time);

  const baseStats =
    result.rows.length === 0
      ? {
          total_points: 0,
          current_streak: 0,
          highest_streak: 0,
          last_prayer_date: null,
        }
      : result.rows[0];

  // Self-heal: if streak is 0 but user has completed prayer days, recalculate
  if (Number(baseStats.current_streak) === 0 && result.rows.length > 0) {
    const { streak: correct, lastDate } = await calculateStreakFromLogs(userId);
    if (correct > 0) {
      await db.execute(
        `UPDATE app.user_stats
         SET current_streak = $1, highest_streak = GREATEST(highest_streak, $1),
             last_prayer_date = COALESCE($3, last_prayer_date)
         WHERE user_id = $2`,
        [correct, userId, lastDate],
      );
      baseStats.current_streak = correct;
      if (correct > Number(baseStats.highest_streak)) {
        baseStats.highest_streak = correct;
      }
      if (lastDate) baseStats.last_prayer_date = lastDate;
    }
  }

  const level = calculateLevel(Number(baseStats.total_points));

  return {
    ...baseStats,
    today_prayers: todayPrayers,
    kaza_prayers: kazaPrayers,
    level,
  };
}

export async function getUserBadges(userId: string) {
  const result = await db.execute(
    `SELECT badge_id, earned_at FROM app.user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    ...row,
    details: BADGE_DETAILS[row.badge_id] || {
      name: row.badge_id,
      description: "",
      icon: "ribbon",
      color: "#94a3b8",
      category: "diğer",
    },
  }));
}

export async function getLeaderboard(limit = 10) {
  const result = await db.execute(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_url, s.total_points, s.current_streak 
     FROM app.user_stats s
     JOIN app.users u ON s.user_id = u.id
     ORDER BY s.total_points DESC 
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function checkAndAwardBadges(userId: string, stats: any) {
  const earnedBadges = await getUserBadges(userId);
  const earnedBadgeIds = earnedBadges.map((b) => b.badge_id);
  const newBadges: string[] = [];

  const checkBadge = async (condition: boolean, badgeId: string) => {
    if (condition && !earnedBadgeIds.includes(badgeId)) {
      await db.execute(
        `INSERT INTO app.user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, badgeId],
      );
      newBadges.push(badgeId);
    }
  };

  const totalPoints = Number(stats.total_points);
  const streak = Number(stats.current_streak);

  await checkBadge(totalPoints > 0, BADGES.FIRST_PRAYER);

  await checkBadge(streak >= 3, BADGES.STREAK_3);
  await checkBadge(streak >= 7, BADGES.STREAK_7);
  await checkBadge(streak >= 14, BADGES.STREAK_14);
  await checkBadge(streak >= 30, BADGES.STREAK_30);
  await checkBadge(streak >= 100, BADGES.STREAK_100);

  await checkBadge(totalPoints >= 100, BADGES.POINTS_100);
  await checkBadge(totalPoints >= 500, BADGES.POINTS_500);
  await checkBadge(totalPoints >= 1000, BADGES.POINTS_1000);
  await checkBadge(totalPoints >= 5000, BADGES.POINTS_5000);

  if (stats.today_prayers_count === 5) {
    await checkBadge(true, BADGES.ALL_PRAYERS);
  }

  const fajrCheck = await db.execute(
    `SELECT COUNT(DISTINCT date) as cnt FROM app.prayer_logs 
     WHERE user_id = $1 AND prayer_time = 'fajr' 
       AND date >= NOW() - INTERVAL '7 days'`,
    [userId],
  );
  const fajrDays = Number(fajrCheck.rows[0]?.cnt || 0);
  await checkBadge(fajrDays >= 7, BADGES.FAJR_MASTER);

  const fajrCheck14 = await db.execute(
    `SELECT COUNT(DISTINCT date) as cnt FROM app.prayer_logs 
     WHERE user_id = $1 AND prayer_time = 'fajr' 
       AND date >= NOW() - INTERVAL '14 days'`,
    [userId],
  );
  const fajrDays14 = Number(fajrCheck14.rows[0]?.cnt || 0);
  await checkBadge(fajrDays14 >= 14, BADGES.EARLY_BIRD);

  const perfectWeekCheck = await db.execute(
    `SELECT COUNT(*) as cnt FROM (
       SELECT date FROM app.prayer_logs
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
       GROUP BY date HAVING COUNT(*) >= 5
     ) sub`,
    [userId],
  );
  const perfectDays = Number(perfectWeekCheck.rows[0]?.cnt || 0);
  await checkBadge(perfectDays >= 7, BADGES.WEEK_PERFECT);

  const perfectMonthCheck = await db.execute(
    `SELECT COUNT(*) as cnt FROM (
       SELECT date FROM app.prayer_logs
       WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'
       GROUP BY date HAVING COUNT(*) >= 5
     ) sub`,
    [userId],
  );
  const perfectMonthDays = Number(perfectMonthCheck.rows[0]?.cnt || 0);
  await checkBadge(perfectMonthDays >= 30, BADGES.MONTH_PERFECT);

  return newBadges;
}

export async function updateStatsForPrayer(
  userId: string,
  targetDateStr: string,
  points: number,
) {
  const todayPrayersRes = await db.execute(
    `SELECT count(*) FROM app.prayer_logs WHERE user_id = $1 AND date = $2`,
    [userId, targetDateStr],
  );
  const todayCount = parseInt(todayPrayersRes.rows[0].count);

  const statsRes = await db.execute(
    `SELECT * FROM app.user_stats WHERE user_id = $1`,
    [userId],
  );

  if (statsRes.rows.length === 0) {
    const streak = todayCount >= 5 ? 1 : 0;
    const lastDate = todayCount >= 5 ? targetDateStr : null;

    const insertRes = await db.execute(
      `INSERT INTO app.user_stats (user_id, total_points, current_streak, highest_streak, last_prayer_date)
       VALUES ($1, $2, $3, $3, $4) RETURNING *`,
      [userId, points, streak, lastDate],
    );
    const newStats = insertRes.rows[0];
    const badges = await checkAndAwardBadges(userId, {
      ...newStats,
      today_prayers_count: todayCount,
    });
    const level = calculateLevel(Number(newStats.total_points));
    return {
      stats: { ...newStats, today_prayers_count: todayCount, level },
      newBadges: badges,
      streakIncremented: streak === 1,
    };
  }

  const stats = statsRes.rows[0];
  const prevStreak = Number(stats.current_streak);
  const newTotalPoints = Number(stats.total_points) + points;
  let newStreak = prevStreak;
  let newLastDate = stats.last_prayer_date;
  let streakIncremented = false;

  if (todayCount >= 5) {
    // Unconditional recalculate — no stale-date gates, always read truth from logs
    const { streak: correct, lastDate: correctLastDate } = await calculateStreakFromLogs(userId);
    newStreak = correct;
    newLastDate = correctLastDate ?? targetDateStr;
    streakIncremented = correct > prevStreak;
  } else {
    const lastCompletedDateStr = safeLastDate(stats.last_prayer_date);
    const yesterdayStr = prevDay(targetDateStr);
    if (
      lastCompletedDateStr &&
      lastCompletedDateStr !== targetDateStr &&
      lastCompletedDateStr !== yesterdayStr
    ) {
      newStreak = 0;
    }
  }

  const highestStreak = Math.max(stats.highest_streak, newStreak);

  const updateRes = await db.execute(
    `UPDATE app.user_stats 
     SET total_points = $1, current_streak = $2, highest_streak = $3, last_prayer_date = $4, updated_at = NOW()
     WHERE user_id = $5 RETURNING *`,
    [newTotalPoints, newStreak, highestStreak, newLastDate, userId],
  );

  const newStats = updateRes.rows[0];
  const badges = await checkAndAwardBadges(userId, {
    ...newStats,
    today_prayers_count: todayCount,
  });
  const level = calculateLevel(Number(newStats.total_points));
  return {
    stats: { ...newStats, today_prayers_count: todayCount, level },
    newBadges: badges,
    streakIncremented,
  };
}

export async function getWeeklyStats(userId: string) {
  const result = await db.execute(
    `SELECT 
       date,
       COUNT(*) as prayer_count,
       SUM(CASE WHEN is_kaza THEN 1 ELSE 0 END) as kaza_count,
       SUM(points_earned) as points
     FROM app.prayer_logs
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
     GROUP BY date
     ORDER BY date ASC`,
    [userId],
  );

  const byPrayerTime = await db.execute(
    `SELECT 
        prayer_time,
        COUNT(*) as total,
        SUM(CASE WHEN is_kaza THEN 1 ELSE 0 END) as kaza_count
    FROM app.prayer_logs
    WHERE user_id = $1 AND date >= NOW() - INTERVAL '7 days'
    GROUP BY prayer_time
    ORDER BY 
        CASE prayer_time
            WHEN 'fajr' THEN 1
            WHEN 'dhuhr' THEN 2
            WHEN 'asr' THEN 3
            WHEN 'maghrib' THEN 4
            WHEN 'isha' THEN 5
            ELSE 6
        END ASC;`,
    [userId],
  );

  return {
    daily: result.rows,
    byPrayerTime: byPrayerTime.rows,
  };
}

export async function addPointsForActivity(userId: string, points: number): Promise<void> {
  if (points <= 0) return;
  await db.execute(
    `INSERT INTO app.user_stats (user_id, total_points, current_streak, highest_streak)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (user_id) DO UPDATE
     SET total_points = app.user_stats.total_points + $2, updated_at = NOW()`,
    [userId, points],
  );
  const statsRes = await db.execute(
    `SELECT total_points FROM app.user_stats WHERE user_id = $1`,
    [userId],
  );
  if (statsRes.rows.length > 0) {
    await checkAndAwardBadges(userId, {
      ...statsRes.rows[0],
      today_prayers_count: 0,
      current_streak: 0,
    }).catch(() => {});
  }
}

export async function getMonthlyStats(userId: string) {
  const result = await db.execute(
    `SELECT 
       TO_CHAR(date, 'YYYY-MM-W') as week,
       COUNT(*) as prayer_count,
       SUM(CASE WHEN is_kaza THEN 1 ELSE 0 END) as kaza_count,
       COUNT(DISTINCT date) as active_days
     FROM app.prayer_logs
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'
     GROUP BY TO_CHAR(date, 'YYYY-MM-W')
     ORDER BY week ASC`,
    [userId],
  );

  const totalRes = await db.execute(
    `SELECT 
       COUNT(*) as total_prayers,
       SUM(CASE WHEN is_kaza THEN 1 ELSE 0 END) as total_kaza,
       COUNT(DISTINCT date) as active_days
     FROM app.prayer_logs
     WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'`,
    [userId],
  );

  return {
    weekly: result.rows,
    totals: totalRes.rows[0],
  };
}
