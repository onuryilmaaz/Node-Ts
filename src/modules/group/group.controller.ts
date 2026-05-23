import type { Request, Response } from "express";
import * as service from "./group.service";
import * as schema from "./group.schema";

function forbidden(res: Response) {
  return res.status(403).json({ success: false, message: "Yetkiniz yok." });
}

function notFound(res: Response) {
  return res.status(404).json({ success: false, message: "Bulunamadı." });
}

function handleServiceError(res: Response, result: { error: string }) {
  switch (result.error) {
    case "forbidden":            return forbidden(res);
    case "not_found":            return notFound(res);
    case "not_member":           return res.status(403).json({ success: false, message: "Bu grubun üyesi değilsiniz." });
    case "already_member":       return res.status(409).json({ success: false, message: "Zaten bu grubun üyesisiniz." });
    case "full":                 return res.status(409).json({ success: false, message: "Grup maksimum üye sayısına ulaştı." });
    case "owner_cannot_leave":   return res.status(400).json({ success: false, message: "Grup sahibi gruptan ayrılamaz. Önce başkasına devredin veya grubu silin." });
    case "cannot_remove_owner":  return res.status(400).json({ success: false, message: "Grup sahibi çıkarılamaz." });
    case "no_changes":           return res.status(400).json({ success: false, message: "Güncellenecek alan bulunamadı." });
    default:                     return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GROUP CRUD ───────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const group = await service.createGroup(userId, parsed.data);
    return res.status(201).json({ success: true, data: group });
  } catch (err) {
    console.error("create group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function myGroups(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await service.getUserGroups(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("my groups:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getGroup(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await service.getGroupById(req.params.id!, userId);
    if (!data) return notFound(res);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("get group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.updateGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.updateGroup(req.params.id!, userId, parsed.data);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("update group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.deleteGroup(req.params.id!, userId);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true });
  } catch (err) {
    console.error("delete group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── MEMBERSHIP ───────────────────────────────────────────────────────────────

export async function join(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.joinGroupByCode(userId, req.params.inviteCode!);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("join group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function leave(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.leaveGroup(userId, req.params.id!);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true });
  } catch (err) {
    console.error("leave group:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function kickMember(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.removeMember(req.params.id!, userId, req.params.memberId!);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true });
  } catch (err) {
    console.error("kick member:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function uploadAvatar(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ success: false, message: "Dosya gerekli." });

    const result = await service.uploadGroupAvatar(req.params.id!, userId, req.file);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("upload group avatar:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateMemberRole(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.updateMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.updateMemberRole(
      req.params.id!,
      userId,
      req.params.memberId!,
      parsed.data.role,
    );
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true });
  } catch (err) {
    console.error("update member role:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── ACTIVITY TYPES ───────────────────────────────────────────────────────────

export async function addActivityType(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.addActivityTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.addActivityType(req.params.id!, userId, parsed.data);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("add activity type:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteActivityType(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.deleteActivityType(req.params.id!, userId, req.params.typeId!);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true });
  } catch (err) {
    console.error("delete activity type:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GOALS ────────────────────────────────────────────────────────────────────

export async function createGoal(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.createGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.createGoal(req.params.id!, userId, parsed.data);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("create goal:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function listGoals(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await service.getGoals(req.params.id!);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("list goals:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateGoal(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.updateGoalStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.updateGoalStatus(req.params.id!, userId, req.params.goalId!, parsed.data.status);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("update goal:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── GOAL SUGGESTIONS ────────────────────────────────────────────────────────

export async function suggestGoal(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.goalSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.suggestGoal(req.params.id!, userId, parsed.data);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("suggest goal:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function listGoalSuggestions(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await service.getGoalSuggestions(req.params.id!, userId);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("list suggestions:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function reviewGoalSuggestion(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.reviewSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.reviewSuggestion(req.params.id!, userId, req.params.suggestionId!, parsed.data.approved);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("review suggestion:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── MANUAL ACTIVITY LOG ─────────────────────────────────────────────────────

export async function logManualActivity(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed = schema.manualActivityLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });
    }

    const result = await service.logManualActivity(req.params.id!, userId, parsed.data);
    if ("error" in result) return handleServiceError(res, result as { error: string });
    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("manual activity log:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ─── FEED & LEADERBOARD ───────────────────────────────────────────────────────

export async function feed(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const data = await service.getFeed(req.params.id!, limit, offset);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("group feed:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function leaderboard(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const period = (req.query.period as string) || "all";
    if (!["all", "week", "month", "custom"].includes(period)) {
      return res.status(400).json({ success: false, message: "Geçersiz period. (all | week | month | custom)" });
    }

    const { start, end } = req.query as { start?: string; end?: string };
    if (period === "custom" && (!start || !end)) {
      return res.status(400).json({ success: false, message: "custom period için start ve end gerekli." });
    }

    const data = await service.getLeaderboard(req.params.id!, period as any, start, end);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("leaderboard:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
