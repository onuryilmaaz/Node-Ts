import { Router } from "express";
import { getDailyPrayer } from "./prayer.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/daily", authMiddleware, getDailyPrayer);

export default router;
