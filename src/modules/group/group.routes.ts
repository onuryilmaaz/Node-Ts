import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as controller from "./group.controller";

const router = Router();
router.use(authMiddleware);

// Membership (spesifik önce, wildcard sonra)
router.get("/me",                                    controller.myGroups);
router.post("/join/:inviteCode",                     controller.join);

// Group CRUD
router.post("/",                                     controller.create);
router.get("/:id",                                   controller.getGroup);
router.patch("/:id",                                 controller.update);
router.delete("/:id",                                controller.remove);
router.post("/:id/avatar", upload.single("avatar"),  controller.uploadAvatar);

// Membership actions
router.post("/:id/leave",                            controller.leave);
router.delete("/:id/members/:memberId",              controller.kickMember);
router.patch("/:id/members/:memberId/role",          controller.updateMemberRole);

// Activity types
router.post("/:id/activity-types",                   controller.addActivityType);
router.delete("/:id/activity-types/:typeId",         controller.deleteActivityType);

// Goals
router.post("/:id/goals",                            controller.createGoal);
router.get("/:id/goals",                             controller.listGoals);
router.patch("/:id/goals/:goalId",                   controller.updateGoal);

// Goal suggestions
router.post("/:id/goal-suggestions",                 controller.suggestGoal);
router.get("/:id/goal-suggestions",                  controller.listGoalSuggestions);
router.patch("/:id/goal-suggestions/:suggestionId",  controller.reviewGoalSuggestion);

// Manual activity log
router.post("/:id/activity-logs",                    controller.logManualActivity);

// Feed & Leaderboard
router.get("/:id/feed",                              controller.feed);
router.get("/:id/leaderboard",                       controller.leaderboard);

export default router;
