import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  logActivityHandler,
  updateLogHandler,
  deleteLogHandler,
  getTodayLogsHandler,
  getDateLogsHandler,
  getWeeklyStatsHandler,
  getMonthlyStatsHandler,
} from "./tracker.controller";

const router = Router();

router.use(authMiddleware);

router.get("/today", getTodayLogsHandler);
router.get("/date/:date", getDateLogsHandler);
router.get("/stats/weekly", getWeeklyStatsHandler);
router.get("/stats/monthly", getMonthlyStatsHandler);
router.post("/", logActivityHandler);
router.patch("/:id", updateLogHandler);
router.delete("/:id", deleteLogHandler);

export default router;
