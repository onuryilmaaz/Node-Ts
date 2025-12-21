import { Router } from "express";
import {
  changePasswordController,
  deactivateAccountController,
  getProfile,
  updateProfile,
  uploadAvatar,
} from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";

const router = Router();

router.get("/profile", authMiddleware, getProfile);
router.post("/change-password", authMiddleware, changePasswordController);
router.post("/avatar", authMiddleware, upload.single("avatar"), uploadAvatar);
router.patch("/update-profile", authMiddleware, updateProfile);
router.post("/deactivate", authMiddleware, deactivateAccountController);

export default router;
