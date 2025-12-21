import { Router } from "express";
import type { Request, Response } from "express";
import { requireRole } from "../../middleware/requireRole";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  activateUser,
  deactivateUser,
  getUserDetail,
  healthy,
  listUsers,
  listUserSessions,
  revokeAllUserSessions,
} from "./admin.controller";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/healthy", healthy);
router.get("/users", listUsers);
router.get("/users/:userId", getUserDetail);
router.post("/users/:userId/activate", activateUser);
router.post("/users/:userId/deactivate", deactivateUser);
router.get("/users/:userId/sessions", listUserSessions);
router.post("/users/:userId/sessions/revoke-all", revokeAllUserSessions);
export default router;
