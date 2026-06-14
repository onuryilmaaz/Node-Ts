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
import { validate } from "../../middleware/validate";
import {
  trackPrayerSchema,
  untrackPrayerSchema,
  addKazaSchema,
  batchAddKazaSchema,
  quickKazaSchema,
} from "./prayer.schema";

const router = Router();

router.post("/track", authMiddleware, validate(trackPrayerSchema), trackPrayer);
router.delete("/track", authMiddleware, validate(untrackPrayerSchema), untrackPrayer);

router.get("/history", authMiddleware, getPrayerHistory);
router.get("/by-date/:date", authMiddleware, getPrayerLogsForDate);

router.get("/kaza", authMiddleware, getKazaList);
router.post("/kaza", authMiddleware, validate(addKazaSchema), addKazaPrayer);
router.post("/kaza/batch", authMiddleware, validate(batchAddKazaSchema), batchAddKaza);
router.post("/kaza/quick-complete", authMiddleware, validate(quickKazaSchema), quickDecrementKaza);
router.patch("/kaza/:id/complete", authMiddleware, completeKazaPrayer);
router.delete("/kaza/:id", authMiddleware, deleteKazaPrayer);

export default router;
