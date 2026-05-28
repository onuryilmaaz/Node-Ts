import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getActive, start, end } from "./ozel_gun.controller";

const router = Router();

router.get("/active", authMiddleware, getActive);
router.post("/start", authMiddleware, start);
router.post("/end", authMiddleware, end);

export default router;
