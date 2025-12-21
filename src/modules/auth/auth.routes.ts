import { Router } from "express";
import {
  changeEmailConfirm,
  changeEmailRequest,
  forgotPasswordController,
  getUserSessions,
  login,
  logout,
  refresh,
  register,
  resendEmailVerification,
  resetPasswordController,
  revokeOtherSessionsController,
  revokeSessionController,
  verifyEmail,
} from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", authMiddleware, logout);

router.post("/verify-email", verifyEmail);
router.post("/resend-email-otp", resendEmailVerification);

router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

router.post("/change-email/request", authMiddleware, changeEmailRequest);
router.post("/change-email/confirm", authMiddleware, changeEmailConfirm);

router.get("/sessions", authMiddleware, getUserSessions);
router.post("/sessions/revoke", authMiddleware, revokeSessionController);
router.post(
  "/sessions/revoke-others",
  authMiddleware,
  revokeOtherSessionsController
);

export default router;
