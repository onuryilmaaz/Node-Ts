import { Router } from "express";
import {
  getStats,
  getLeaderboardTop,
  getStatsWeekly,
  getStatsMonthly,
  getLevelInfo,
} from "./gamification.controller";
import { getYearlyWrap } from "./yearly.controller";
import {
  getMotivation,
  getInsight,
  getYearlyNarrative,
} from "./motivation.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/stats", authMiddleware, getStats);
router.get("/motivation", authMiddleware, getMotivation);
router.get("/insight", authMiddleware, getInsight);
router.post("/yearly-narrative", authMiddleware, getYearlyNarrative);
router.get("/stats/weekly", authMiddleware, getStatsWeekly);
router.get("/stats/monthly", authMiddleware, getStatsMonthly);
router.get("/level", authMiddleware, getLevelInfo);
router.get("/leaderboard", authMiddleware, getLeaderboardTop);
router.get("/yearly-wrap", authMiddleware, getYearlyWrap);

export default router;
