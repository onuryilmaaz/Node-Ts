import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import { addMosque, getMosques, uploadMosqueImage } from "./mosque.controller";

const router = Router();

router.post("/", authMiddleware, addMosque);
router.post(
  "/upload",
  authMiddleware,
  upload.single("image"),
  uploadMosqueImage,
);
router.get("/", authMiddleware, getMosques);

export default router;
