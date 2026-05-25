import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requireChildSession, requireParentOf } from "../../middleware/child.middleware";
import {
  createChildHandler, getChildrenHandler, getChildHandler, updateChildHandler, deleteChildHandler,
  createChildSessionHandler, setPinHandler,
  createTaskHandler, getTasksHandler, getTaskTemplatesHandler, updateTaskHandler, deleteTaskHandler,
  getTodayTasksHandler, completeTaskHandler, getCompletionsHandler, reviewCompletionHandler, getPendingApprovalsHandler,
  getChildStatsHandler, getWeeklyReportHandler, getMonthlyReportHandler,
  createRewardHandler, getRewardsHandler, redeemRewardHandler, deleteRewardHandler,
} from "./family.controller";

const router = Router();

// Görev şablonları (auth gerektirmez, ebeveyn login öncesi görebilsin)
router.get("/task-templates", getTaskTemplatesHandler);

// ── Ebeveyn rotaları ───────────────────────────────────────────────────────────
router.use(authMiddleware);

// Çocuk profili
router.post("/children", createChildHandler);
router.get("/children", getChildrenHandler);
router.get("/children/:childId", requireParentOf(), getChildHandler);
router.patch("/children/:childId", requireParentOf(), updateChildHandler);
router.delete("/children/:childId", requireParentOf(), deleteChildHandler);

// PIN
router.post("/children/:childId/session", requireParentOf(), createChildSessionHandler);
router.post("/children/:childId/pin", requireParentOf(), setPinHandler);

// Görevler
router.post("/children/:childId/tasks", requireParentOf(), createTaskHandler);
router.get("/children/:childId/tasks", requireParentOf(), getTasksHandler);
router.patch("/children/:childId/tasks/:taskId", requireParentOf(), updateTaskHandler);
router.delete("/children/:childId/tasks/:taskId", requireParentOf(), deleteTaskHandler);

// Tamamlamalar (ebeveyn görünümü)
router.get("/children/:childId/completions", requireParentOf(), getCompletionsHandler);
router.patch("/completions/:completionId/review", reviewCompletionHandler);
router.get("/pending-approvals", getPendingApprovalsHandler);

// İstatistik & rapor
router.get("/children/:childId/stats", requireParentOf(), getChildStatsHandler);
router.get("/children/:childId/report/weekly", requireParentOf(), getWeeklyReportHandler);
router.get("/children/:childId/report/monthly", requireParentOf(), getMonthlyReportHandler);

// Ödüller (ebeveyn yönetimi)
router.post("/children/:childId/rewards", requireParentOf(), createRewardHandler);
router.get("/children/:childId/rewards", requireParentOf(), getRewardsHandler);
router.delete("/rewards/:rewardId", deleteRewardHandler);

// ── Çocuk oturumu rotaları ─────────────────────────────────────────────────────
// Not: Bu rotalar requireChildSession middleware'i kullanır (child token)
router.get("/child/today", requireChildSession, getTodayTasksHandler);
router.post("/tasks/:taskId/complete", requireChildSession, completeTaskHandler);
router.post("/rewards/:rewardId/redeem", requireChildSession, redeemRewardHandler);

export default router;
