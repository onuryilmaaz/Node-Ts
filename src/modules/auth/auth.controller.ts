import type { Request, Response } from "express";
import {
  registerSchema,
  loginSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  resetPasswordSchema,
  changeEmailRequestSchema,
  changeEmailConfirmSchema,
} from "./auth.schema";
import {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  resetPassword,
  requestChangeEmail,
  confirmChangeEmail,
  listUserSessions,
  revokeSession,
  revokeOtherSessions,
} from "./auth.service";

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);
    const user = await registerUser(data);

    res.status(201).json({
      id: user!.id,
      email: user!.email,
    });
  } catch (err: any) {
    if (err.message === "EMAIL_EXISTS") {
      return res.status(409).json({
        message: "Email already in use",
      });
    }

    res.status(400).json({
      message: "Invalid request",
      error: err?.errors ?? err?.message,
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const userAgent = req.headers["user-agent"] ?? null;
    const result = await loginUser({
      ...data,
      userAgent,
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === "ACCOUNT_DEACTIVATED") {
      return res.status(403).json({
        message:
          "Hesabınız pasif durumdadır. Lütfen yönetici ile iletişime geçin.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        message: "E-posta veya şifre hatalı.",
        code: "INVALID_CREDENTIALS",
      });
    }

    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: "Sunucu hatası",
    });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken)
      return res.status(400).json({ message: "refreshToken required" });

    const userAgent = req.headers["user-agent"] ?? null;

    const result = await refreshSession({ refreshToken, userAgent });
    res.json(result);
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken required" });
    }

    await logoutUser(refreshToken);

    return res.json({ message: "Logged out" });
  } catch (err) {
    return res.status(500).json({ message: "Logout failed" });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const data = verifyEmailOtpSchema.parse(req.body);

    await verifyEmailOtp(data);

    res.json({ message: "Email verified" });
  } catch (err: any) {
    if (err.message === "INVALID_CODE")
      return res.status(400).json({ message: "Invalid or expired code" });

    res
      .status(400)
      .json({ message: "Invalid request", error: err?.errors ?? err?.message });
  }
}

export async function resendEmailVerification(req: Request, res: Response) {
  try {
    const data = resendEmailOtpSchema.parse(req.body);
    await resendEmailOtp(data);

    res.json({ message: "If the email exists, a new code has been sent." });
  } catch (err: any) {
    if (err.message === "OTP_RATE_LIMIT")
      return res
        .status(429)
        .json({ message: "Please wait before requesting another code" });

    if (err.message === "OTP_DAILY_LIMIT")
      return res.status(429).json({ message: "Daily OTP limit reached" });

    res.status(400).json({ message: "Invalid request" });
  }
}

export async function forgotPasswordController(req: Request, res: Response) {
  try {
    await forgotPassword({ email: req.body.email });
    res.json({
      message: "If the email exists, a verification code has been sent",
    });
  } catch (e: any) {
    if (e.message === "OTP_RATE_LIMIT")
      return res.status(429).json({ message: "Please wait before retrying" });
    if (e.message === "OTP_DAILY_LIMIT")
      return res.status(429).json({ message: "Daily limit reached" });

    res.status(500).json({ message: "Failed to process request" });
  }
}

export async function resetPasswordController(req: Request, res: Response) {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await resetPassword(data);
    res.json({ message: "Password updated successfully" });
  } catch (err: any) {
    if (err?.errors) {
      return res.status(400).json({
        message: "Invalid request",
        error: err.errors,
      });
    }

    if (err.message === "INVALID_OTP") {
      return res.status(400).json({
        message: "Invalid or expired code",
      });
    }

    res.status(500).json({
      message: "Failed to reset password",
    });
  }
}

export async function changeEmailRequest(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { newEmail } = changeEmailRequestSchema.parse(req.body);

  try {
    await requestChangeEmail(req.user.userId, newEmail);
    return res.json({
      success: true,
      reloginRequired: true,
    });
  } catch (err: any) {
    if (err.message === "EMAIL_IN_USE")
      res.status(409).json({ message: "Email already in use" });

    res.status(400).json({ message: "Request failed" });
  }
}

export async function changeEmailConfirm(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { otp } = changeEmailConfirmSchema.parse(req.body);
  const { newEmail } = req.body as { newEmail: string };

  try {
    await confirmChangeEmail(req.user.userId, otp, newEmail);
    res.json({ success: true });
  } catch {
    res.status(400).json({ message: "Invalid or expired code" });
  }
}

export async function getUserSessions(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const sessions = await listUserSessions(req.user.userId);

  res.json({ sessions });
}

export async function revokeSessionController(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { sessionId } = req.body;
  if (!sessionId)
    return res.status(400).json({ message: "sessionId required" });

  try {
    await revokeSession(req.user.userId, sessionId);
    res.json({ success: true });
  } catch {
    res.status(404).json({ message: "Session not found" });
  }
}

export async function revokeOtherSessionsController(
  req: Request,
  res: Response
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = req.headers["x-refresh-token"];
  if (!refreshToken || typeof refreshToken !== "string")
    return res.status(400).json({ message: "refresh token required" });

  await revokeOtherSessions(req.user.userId, refreshToken);
  res.json({ success: true });
}
