import type { Request, Response } from "express";
import {
  adminUserIdParamSchema,
  assignRoleSchema,
  createRoleSchema,
  updateRoleSchema,
} from "./admin.schema";
import {
  adminActivateUser,
  adminDashboardStats,
  adminDeactivateUser,
  adminGetUserDetail,
  adminListUserSessions,
  adminListUsers,
  adminRevokeAllUserSessions,
  assignRoleToUser,
  createRole,
  deleteRoleById,
  getAllRoles,
  removeRoleFromUser,
  updateRoleById,
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

export async function listRoles(req: Request, res: Response) {
  try {
    const roles = await getAllRoles();
    res.json({ roles });
  } catch {
    res.status(500).json({ message: "Failed to load roles" });
  }
}

export async function createRoleController(req: Request, res: Response) {
  console.log("CREATE ROLE REQ BODY:", req.body);
  try {
    const data = createRoleSchema.parse(req.body);
    const role = await createRole(data.name);

    res.status(201).json({ role });
  } catch (err: any) {
    if (err.message === "ROLE_EXISTS") {
      return res.status(409).json({ message: "Role already exists" });
    }

    if (err?.errors) {
      return res.status(400).json({
        message: "Invalid request",
        error: err.errors,
      });
    }

    res.status(500).json({ message: "Failed to create role" });
  }
}

export async function updateRoleController(req: Request, res: Response) {
  try {
    const { roleId } = req.params;
    const data = updateRoleSchema.parse(req.body);

    if (!roleId) {
      return res.status(400).json({ message: "roleId is required" });
    }

    const role = await updateRoleById(roleId, data.name);

    res.json({ role });
  } catch (err: any) {
    if (err?.errors) {
      return res.status(400).json({
        message: "Validation error",
        errors: err.errors,
      });
    }

    if (err.message === "ROLE_NOT_FOUND") {
      return res.status(404).json({ message: "Role not found" });
    }

    if (err.message === "ROLE_PROTECTED") {
      return res.status(400).json({ message: "This role cannot be modified" });
    }

    if (err.message === "ROLE_EXISTS") {
      return res.status(409).json({ message: "Role already exists" });
    }

    console.error("UPDATE ROLE ERROR:", err);
    return res.status(500).json({ message: "Failed to update role" });
  }
}

export async function deleteRoleController(req: Request, res: Response) {
  try {
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({ message: "roleId is required" });
    }

    await deleteRoleById(roleId);

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "ROLE_NOT_FOUND")
      return res.status(404).json({ message: "Role not found" });

    if (err.message === "ROLE_PROTECTED")
      return res.status(400).json({ message: "This role cannot be deleted" });

    if (err.message === "ROLE_IN_USE")
      return res.status(400).json({ message: "Role is assigned to users" });

    res.status(500).json({ message: "Failed to delete role" });
  }
}

export async function assignRoleToUserController(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { roleId } = assignRoleSchema.parse(req.body);

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    await assignRoleToUser(userId, roleId);

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND")
      return res.status(404).json({ message: "User not found" });

    if (err.message === "USER_INACTIVE")
      return res.status(400).json({ message: "User is inactive" });

    if (err.message === "ROLE_NOT_FOUND")
      return res.status(404).json({ message: "Role not found" });

    if (err.message === "ROLE_ALREADY_ASSIGNED")
      return res.status(409).json({ message: "Role already assigned" });

    res.status(500).json({ message: "Failed to assign role" });
  }
}

export async function removeRoleFromUserController(
  req: Request,
  res: Response
) {
  try {
    const { userId, roleId } = req.params;

    if (!userId || !roleId) {
      return res
        .status(400)
        .json({ message: "userId and roleId are required" });
    }

    await removeRoleFromUser(userId, roleId);

    res.json({ success: true });
  } catch (err: any) {
    if (err.message === "ROLE_NOT_FOUND")
      return res.status(404).json({ message: "Role not found" });

    if (err.message === "ROLE_PROTECTED")
      return res.status(400).json({ message: "Admin role cannot be removed" });

    if (err.message === "ROLE_NOT_ASSIGNED")
      return res.status(400).json({ message: "Role not assigned to user" });

    res.status(500).json({ message: "Failed to remove role" });
  }
}

export async function getAdminDashboard(req: Request, res: Response) {
  try {
    const stats = await adminDashboardStats();
    res.json(stats);
  } catch {
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
}
