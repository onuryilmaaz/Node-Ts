import type { Request, Response } from "express";
import { adminUserIdParamSchema } from "./admin.schema";
import {
  adminActivateUser,
  adminDeactivateUser,
  adminGetUserDetail,
  adminListUserSessions,
  adminListUsers,
  adminRevokeAllUserSessions,
} from "./admin.service";

export async function healthy(req: Request, res: Response) {
  res.json({
    status: "Ok",
    userId: req.user!.userId,
    roles: req.user!.roles,
  });
}

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await adminListUsers();
    return res.json({ users });
  } catch (err: any) {
    return res.status(500).json({
      message: "Failed to list users",
      error: err?.message,
    });
  }
}

export async function getUserDetail(req: Request, res: Response) {
  try {
    const { userId } = adminUserIdParamSchema.parse(req.params);
    const user = await adminGetUserDetail(userId);
    return res.json(user);
  } catch (err: any) {
    if (err?.errors) {
      return res
        .status(400)
        .json({ message: "Invalid request", error: err.errors });
    }
    if (err?.message === "USER_NOT_FOUND") {
      return res.status(404).json({ message: "User not found" });
    }
    return res
      .status(500)
      .json({ message: "Failed to load user", error: err?.message });
  }
}

export async function activateUser(req: Request, res: Response) {
  try {
    const { userId } = adminUserIdParamSchema.parse(req.params);
    await adminActivateUser(userId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err?.errors)
      return res
        .status(400)
        .json({ message: "Invalid request", error: err.errors });
    if (err?.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });
    return res
      .status(500)
      .json({ message: "Failed to activate user", error: err?.message });
  }
}

export async function deactivateUser(req: Request, res: Response) {
  try {
    const { userId } = adminUserIdParamSchema.parse(req.params);
    const result = await adminDeactivateUser(userId);
    return res.json(result);
  } catch (err: any) {
    if (err?.errors)
      return res
        .status(400)
        .json({ message: "Invalid request", error: err.errors });
    if (err?.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });
    return res
      .status(500)
      .json({ message: "Failed to deactivate user", error: err?.message });
  }
}

export async function listUserSessions(req: Request, res: Response) {
  try {
    const { userId } = adminUserIdParamSchema.parse(req.params);
    const sessions = await adminListUserSessions(userId);
    return res.json({ sessions });
  } catch (err: any) {
    if (err?.errors)
      return res
        .status(400)
        .json({ message: "Invalid request", error: err.errors });
    if (err?.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });
    return res
      .status(500)
      .json({ message: "Failed to list sessions", error: err?.message });
  }
}

export async function revokeAllUserSessions(req: Request, res: Response) {
  try {
    const { userId } = adminUserIdParamSchema.parse(req.params);
    await adminRevokeAllUserSessions(userId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err?.errors)
      return res
        .status(400)
        .json({ message: "Invalid request", error: err.errors });
    if (err?.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });
    return res
      .status(500)
      .json({ message: "Failed to revoke sessions", error: err?.message });
  }
}
