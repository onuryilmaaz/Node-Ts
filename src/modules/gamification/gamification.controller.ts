import type { Request, Response } from "express";
import {
  getUserStats,
  getUserBadges,
  getLeaderboard,
  getWeeklyStats,
  getMonthlyStats,
  BADGE_DETAILS,
  LEVELS,
  calculateLevel,
} from "./gamification.service";

export async function getStats(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const stats = await getUserStats(userId);
    const badges = await getUserBadges(userId);

    return res.json({
      success: true,
      data: {
        stats,
        badges,
        allBadges: BADGE_DETAILS,
        levels: LEVELS,
      }
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getLeaderboardTop(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const leaderboard = await getLeaderboard(limit);
    return res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getStatsWeekly(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await getWeeklyStats(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching weekly stats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getStatsMonthly(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await getMonthlyStats(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching monthly stats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getLevelInfo(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const stats = await getUserStats(userId);
    const level = calculateLevel(Number(stats.total_points));
    return res.json({ success: true, data: { level, total_points: stats.total_points } });
  } catch (err) {
    console.error("Error fetching level:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
