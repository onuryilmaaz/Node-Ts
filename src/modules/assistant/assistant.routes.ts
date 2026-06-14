import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { chatSchema } from "./assistant.schema";
import { chatHandler } from "./assistant.controller";

const router = Router();
router.use(authMiddleware);

router.post("/chat", validate(chatSchema), chatHandler);

export default router;
