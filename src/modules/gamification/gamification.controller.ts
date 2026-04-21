import type { Request, Response } from "express";
import { getUserStats, getUserBadges, getLeaderboard, BADGE_DETAILS } from "./gamification.service";

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
        allBadges: BADGE_DETAILS
      }
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getLeaderboardTop(req: Request, res: Response) {
  try {
    const leaderboard = await getLeaderboard(10);
    return res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
