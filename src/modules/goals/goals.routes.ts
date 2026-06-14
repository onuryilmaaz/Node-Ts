import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { upsertGoalSchema } from "./goals.schema";
import {
  getGoalsHandler,
  upsertGoalHandler,
  deleteGoalHandler,
  suggestGoalsHandler,
} from "./goals.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", getGoalsHandler);
router.get("/suggest", suggestGoalsHandler);
router.put("/", validate(upsertGoalSchema), upsertGoalHandler);
router.delete("/:activity_type", deleteGoalHandler);

export default router;
