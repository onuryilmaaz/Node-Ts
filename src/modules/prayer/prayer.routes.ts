import { Router } from "express";
import {
  trackPrayer,
  untrackPrayer,
  getKazaList,
  addKazaPrayer,
  completeKazaPrayer,
  deleteKazaPrayer,
  getPrayerHistory,
} from "./prayer.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Bugünkü namaz takibi
router.post("/track",   authMiddleware, trackPrayer);
router.delete("/track", authMiddleware, untrackPrayer);

// Namaz geçmişi
router.get("/history",  authMiddleware, getPrayerHistory);

// Kaza namaz yönetimi
router.get("/kaza",            authMiddleware, getKazaList);
router.post("/kaza",           authMiddleware, addKazaPrayer);
router.patch("/kaza/:id/complete", authMiddleware, completeKazaPrayer);
router.delete("/kaza/:id",     authMiddleware, deleteKazaPrayer);

export default router;
