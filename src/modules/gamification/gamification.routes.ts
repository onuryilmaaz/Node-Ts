import { Router } from "express";
import {
  getStats,
  getLeaderboardTop,
  getStatsWeekly,
  getStatsMonthly,
  getLevelInfo,
} from "./gamification.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/stats",          authMiddleware, getStats);
router.get("/stats/weekly",   authMiddleware, getStatsWeekly);
router.get("/stats/monthly",  authMiddleware, getStatsMonthly);
router.get("/level",          authMiddleware, getLevelInfo);
router.get("/leaderboard",    authMiddleware, getLeaderboardTop);

export default router;
