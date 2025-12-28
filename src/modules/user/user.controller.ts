import type { Request, Response } from "express";
import {
  changePassword,
  deactivateAccount,
  getUserProfile,
  updateUserProfile,
  uploadAvatarService,
} from "./user.service";
import { changePasswordSchema, updateProfileSchema } from "./user.schema";
import { buildFileUrl } from "../../services/file.service";

export async function getProfile(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const profile = await getUserProfile(req.user.userId);
    res.json(profile);
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });

    res.status(500).json({ message: "Failed to load profile" });
  }
}

export async function changePasswordController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const data = changePasswordSchema.parse(req.body);

    await changePassword(req.user.userId, data);

    res.json({ message: "Password changed successfully" });
  } catch (err: any) {
    if (err?.errors) {
      return res.status(400).json({
        message: "Invalid request",
        error: err.errors,
      });
    }

    if (err.message === "INVALID_CURRENT_PASSWORD") {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    if (err.message === "PASSWORD_SAME_AS_OLD") {
      return res.status(400).json({
        message: "New password must be different from the old password",
      });
    }

    if (err.message === "PASSWORD_NOT_SET") {
      return res.status(400).json({
        message:
          "This account does not have a password. Use social login or set a password first.",
      });
    }

    res.status(500).json({ message: "Failed to change password" });
  }
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "File required" });
  }

  const avatarUrl = await uploadAvatarService(req.user.userId, req.file);

  res.json({ avatarUrl });
}

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const data = updateProfileSchema.parse(req.body);

  await updateUserProfile(req.user.userId, data);

  res.json({ success: true });
}

export async function deactivateAccountController(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  await deactivateAccount(req.user.userId);

  res.json({
    success: true,
    reloginRequired: true,
  });
}
