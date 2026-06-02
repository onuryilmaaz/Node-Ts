import { Router } from "express";
import {
  trackPrayer,
  untrackPrayer,
  getKazaList,
  addKazaPrayer,
  batchAddKaza,
  quickDecrementKaza,
  completeKazaPrayer,
  deleteKazaPrayer,
  getPrayerHistory,
  getPrayerLogsForDate,
} from "./prayer.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.post("/track", authMiddleware, trackPrayer);
router.delete("/track", authMiddleware, untrackPrayer);

router.get("/history", authMiddleware, getPrayerHistory);
router.get("/by-date/:date", authMiddleware, getPrayerLogsForDate);

router.get("/kaza", authMiddleware, getKazaList);
router.post("/kaza", authMiddleware, addKazaPrayer);
router.post("/kaza/batch", authMiddleware, batchAddKaza);
router.post("/kaza/quick-complete", authMiddleware, quickDecrementKaza);
router.patch("/kaza/:id/complete", authMiddleware, completeKazaPrayer);
router.delete("/kaza/:id", authMiddleware, deleteKazaPrayer);

export default router;
