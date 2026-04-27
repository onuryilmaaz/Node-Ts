import { Router } from "express";
import { listChallenges, join, history } from "./challenge.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.get("/",            authMiddleware, listChallenges);
router.post("/:id/join",   authMiddleware, join);
router.get("/history",     authMiddleware, history);

export default router;
