import { Router } from "express";
import { trackPrayer } from "./prayer.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.post("/track", authMiddleware, trackPrayer);

export default router;
