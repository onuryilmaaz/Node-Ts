import { db } from "../../db";

export const BADGES = {
  FIRST_PRAYER: "ilk_adim",
  STREAK_3: "seri_3_gun",
  STREAK_7: "seri_7_gun",
  POINTS_100: "yuz_puan",
  POINTS_500: "bes_yuz_puan"
};

export const BADGE_DETAILS = {
  [BADGES.FIRST_PRAYER]: { id: BADGES.FIRST_PRAYER, name: "İlk Adım", description: "İlk namazını takip ettin!" },
  [BADGES.STREAK_3]: { id: BADGES.STREAK_3, name: "3 Günlük Seri", description: "3 gün üst üste namaz takibi!" },
  [BADGES.STREAK_7]: { id: BADGES.STREAK_7, name: "7 Günlük Seri", description: "Harika! 7 gündür eksiksiz takip." },
  [BADGES.POINTS_100]: { id: BADGES.POINTS_100, name: "100 Puan", description: "100 puana ulaştın." },
  [BADGES.POINTS_500]: { id: BADGES.POINTS_500, name: "500 Puan", description: "Maşallah! 500 puana ulaştın." }
};

export async function getUserStats(userId: string) {
  const result = await db.execute(
    `SELECT total_points, current_streak, highest_streak, last_prayer_date FROM app.user_stats WHERE user_id = $1`,
    [userId]
  );
  
  const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).toISOString().split("T")[0];
  const todayPrayersRes = await db.execute(
    `SELECT prayer_time FROM app.prayer_logs WHERE user_id = $1 AND date = $2`,
    [userId, todayStr]
  );
  
  const todayPrayers = todayPrayersRes.rows.map(r => r.prayer_time);

  if (result.rows.length === 0) {
    return {
      total_points: 0,
      current_streak: 0,
      highest_streak: 0,
      last_prayer_date: null,
      today_prayers: todayPrayers
    };
  }
  return { ...result.rows[0], today_prayers: todayPrayers };
}


export async function getUserBadges(userId: string) {
  const result = await db.execute(
    `SELECT badge_id, earned_at FROM app.user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
    [userId]
  );
  return result.rows.map(row => ({
    ...row,
    details: BADGE_DETAILS[row.badge_id] || { name: row.badge_id, description: "" }
  }));
}

export async function getLeaderboard(limit = 10) {
  const result = await db.execute(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_url, s.total_points, s.current_streak 
     FROM app.user_stats s
     JOIN app.users u ON s.user_id = u.id
     ORDER BY s.total_points DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function checkAndAwardBadges(userId: string, stats: any) {
  const earnedBadges = await getUserBadges(userId);
  const earnedBadgeIds = earnedBadges.map(b => b.badge_id);
  const newBadges: string[] = [];

  const checkBadge = async (condition: boolean, badgeId: string) => {
    if (condition && !earnedBadgeIds.includes(badgeId)) {
      await db.execute(
        `INSERT INTO app.user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, badgeId]
      );
      newBadges.push(badgeId);
    }
  };

  // Check conditions
  await checkBadge(stats.total_points > 0, BADGES.FIRST_PRAYER);
  await checkBadge(stats.current_streak >= 3, BADGES.STREAK_3);
  await checkBadge(stats.current_streak >= 7, BADGES.STREAK_7);
  await checkBadge(stats.total_points >= 100, BADGES.POINTS_100);
  await checkBadge(stats.total_points >= 500, BADGES.POINTS_500);

  return newBadges;
}

export async function updateStatsForPrayer(userId: string, targetDate: Date, points: number) {
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  // 1. Get today's current prayer count (including the one just added)
  const todayPrayersRes = await db.execute(
    `SELECT count(*) FROM app.prayer_logs WHERE user_id = $1 AND date = $2`,
    [userId, targetDateStr]
  );
  const todayCount = parseInt(todayPrayersRes.rows[0].count);

  // 2. Get current stats
  const statsRes = await db.execute(`SELECT * FROM app.user_stats WHERE user_id = $1`, [userId]);
  
  if (statsRes.rows.length === 0) {
    // First time entering gamification
    const streak = todayCount === 5 ? 1 : 0;
    const lastDate = todayCount === 5 ? targetDateStr : null;
    
    const insertRes = await db.execute(
      `INSERT INTO app.user_stats (user_id, total_points, current_streak, highest_streak, last_prayer_date) 
       VALUES ($1, $2, $3, $3, $4) RETURNING *`,
      [userId, points, streak, lastDate]
    );
    const newStats = insertRes.rows[0];
    const badges = await checkAndAwardBadges(userId, newStats);
    return { stats: { ...newStats, today_prayers_count: todayCount }, newBadges: badges };
  }

  const stats = statsRes.rows[0];
  let newStreak = stats.current_streak;
  let newTotalPoints = stats.total_points + points;
  let newLastDate = stats.last_prayer_date; 
  let lastCompletedDateStr = stats.last_prayer_date ? new Date(stats.last_prayer_date).toISOString().split('T')[0] : null;

  // Streak logic only triggers when the 5th prayer is tracked
  if (todayCount === 5) {
     // Ensure we don't increment twice if for some reason this is called again today
     if (lastCompletedDateStr !== targetDateStr) {
        if (lastCompletedDateStr) {
           const yesterday = new Date(targetDate);
           yesterday.setDate(yesterday.getDate() - 1);
           const yesterdayStr = yesterday.toISOString().split('T')[0];
           
           if (lastCompletedDateStr === yesterdayStr) {
              newStreak += 1;
           } else {
              newStreak = 1;
           }
        } else {
           newStreak = 1;
        }
        newLastDate = targetDateStr;
     }
  } else {
     // If it's a new day and they haven't finished 5 yet, 
     // we don't increment streak. But we should check if they broke their streak?
     // Actually, let's only break the streak when they move to a new day and it's not "yesterday" anymore.
     if (lastCompletedDateStr) {
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // If last completed day was NOT today and NOT yesterday, streak is broken
        if (lastCompletedDateStr !== targetDateStr && lastCompletedDateStr !== yesterdayStr) {
           newStreak = 0;
        }
     }
  }

  const highestStreak = Math.max(stats.highest_streak, newStreak);

  const updateRes = await db.execute(
    `UPDATE app.user_stats 
     SET total_points = $1, current_streak = $2, highest_streak = $3, last_prayer_date = $4, updated_at = NOW()
     WHERE user_id = $5 RETURNING *`,
    [newTotalPoints, newStreak, highestStreak, newLastDate, userId]
  );
  
  const newStats = updateRes.rows[0];
  const badges = await checkAndAwardBadges(userId, newStats);
  return { stats: { ...newStats, today_prayers_count: todayCount }, newBadges: badges };
}
