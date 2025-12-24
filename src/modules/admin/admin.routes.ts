import { Router } from "express";
import type { Request, Response } from "express";
import { requireRole } from "../../middleware/requireRole";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  activateUser,
  assignRoleToUserController,
  createRoleController,
  deactivateUser,
  deleteRoleController,
  getAdminDashboard,
  getUserDetail,
  healthy,
  listRoles,
  listUsers,
  listUserSessions,
  removeRoleFromUserController,
  revokeAllUserSessions,
  updateRoleController,
} from "./admin.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/healthy", healthy);
router.get("/users", listUsers);

router.get("/roles", listRoles);
router.post("/roles", createRoleController);
router.patch("/roles/:roleId", updateRoleController);
router.delete("/roles/:roleId", deleteRoleController);

router.delete("/users/:userId/roles/:roleId", removeRoleFromUserController);
router.post("/users/:userId/roles", assignRoleToUserController);

router.get("/users/:userId/sessions", listUserSessions);
router.post("/users/:userId/activate", activateUser);
router.post("/users/:userId/deactivate", deactivateUser);
router.post("/users/:userId/sessions/revoke-all", revokeAllUserSessions);
router.get("/users/:userId", getUserDetail);

router.get("/dashboard", getAdminDashboard);

export default router;
