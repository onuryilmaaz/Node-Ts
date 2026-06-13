import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { chatHandler } from "./assistant.controller";

const router = Router();
router.use(authMiddleware);

router.post("/chat", chatHandler);

export default router;
