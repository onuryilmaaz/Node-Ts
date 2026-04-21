import { Router } from "express";
import { getDailyPrayer, trackPrayer } from "./prayer.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/daily", authMiddleware, getDailyPrayer);
router.post("/track", authMiddleware, trackPrayer);

export default router;
