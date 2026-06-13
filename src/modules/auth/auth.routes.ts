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
  clerkLogin,
} from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authLimiter, otpLimiter } from "../../middleware/rateLimit";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/clerk-login", authLimiter, clerkLogin);
router.post("/refresh", refresh);
router.post("/logout", authMiddleware, logout);

router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/resend-email-otp", otpLimiter, resendEmailVerification);

router.post("/forgot-password", otpLimiter, forgotPasswordController);
router.post("/reset-password", otpLimiter, resetPasswordController);

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
