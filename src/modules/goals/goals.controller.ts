import type { Request, Response } from "express";
import { getGoals, upsertGoal, deleteGoal } from "./goals.service";
import { getUserStats } from "../gamification/gamification.service";
import { generateGoalSuggestions, aiEnabled } from "../../services/ai.service";

export async function getGoalsHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  try {
    const goals = await getGoals(userId);
    return res.json({ success: true, data: goals });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function upsertGoalHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  const { activity_type, target, enabled } = req.body;
  if (!activity_type || target == null) {
    return res.status(400).json({ success: false, message: "activity_type ve target gerekli" });
  }
  try {
    const goal = await upsertGoal(userId, activity_type, Number(target), enabled ?? true);
    return res.json({ success: true, data: goal });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
}

export async function suggestGoalsHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  if (!aiEnabled) return res.json({ success: true, data: [] });
  try {
    const [goals, stats] = await Promise.all([
      getGoals(userId),
      getUserStats(userId),
    ]);
    const suggestions = await generateGoalSuggestions({
      currentStreak: Number(stats.current_streak) || 0,
      totalPoints: Number(stats.total_points) || 0,
      levelName: stats.level?.name ?? null,
      currentGoals: (goals as any[]).map((g) => ({
        activity_type: g.activity_type,
        target: Number(g.target),
        enabled: Boolean(g.enabled),
      })),
    });
    return res.json({ success: true, data: suggestions ?? [] });
  } catch (e) {
    console.error("Goal suggestion error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteGoalHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  const { activity_type } = req.params;
  try {
    await deleteGoal(userId, activity_type!);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
}
