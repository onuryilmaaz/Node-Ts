import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getGoalsHandler, upsertGoalHandler, deleteGoalHandler } from "./goals.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", getGoalsHandler);
router.put("/", upsertGoalHandler);
router.delete("/:activity_type", deleteGoalHandler);

export default router;
