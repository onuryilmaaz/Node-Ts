import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { listHandler, upsertHandler, deleteHandler } from "./hifz.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", listHandler);
router.put("/", upsertHandler);
router.delete("/:surah_id", deleteHandler);

export default router;
