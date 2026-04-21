import { Router } from "express";
import { getStats, getLeaderboardTop } from "./gamification.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/stats", authMiddleware, getStats);
router.get("/leaderboard", authMiddleware, getLeaderboardTop);

export default router;
