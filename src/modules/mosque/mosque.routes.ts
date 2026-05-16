import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import {
  addMosque,
  getMosques,
  uploadMosqueImage,
  updateMosque,
  deleteMosque,
} from "./mosque.controller";

const router = Router();

router.get("/", authMiddleware, getMosques);
router.post("/", authMiddleware, addMosque);
router.post("/upload", authMiddleware, upload.single("image"), uploadMosqueImage);
router.put("/:id", authMiddleware, updateMosque);
router.delete("/:id", authMiddleware, deleteMosque);

export default router;
