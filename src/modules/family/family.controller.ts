import type { Request, Response } from "express";
import {
  createChild, getChildren, getChildById, updateChild, deleteChild,
  createChildSession, setChildPin,
  createTask, getTasks, updateTask, deleteTask,
  getTodayTasksForChild, completeTask, getCompletions, reviewCompletion, getPendingApprovals,
  getChildStats, getWeeklyReport, getMonthlyReport,
  createReward, getRewards, redeemReward, deleteReward,
} from "./family.service";
import {
  createChildSchema, updateChildSchema, setPinSchema, childSessionSchema,
  createTaskSchema, updateTaskSchema, completeTaskSchema, reviewCompletionSchema,
  createRewardSchema,
} from "./family.schema";
import { TASK_TEMPLATES } from "./family.types";

// ── Children ────────────────────────────────────────────────────────────────────

export async function createChildHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const parsed = createChildSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  const child = await createChild(userId, parsed.data);
  return res.status(201).json({ success: true, data: child });
}

export async function getChildrenHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const children = await getChildren(userId);
  return res.json({ success: true, data: children });
}

export async function getChildHandler(req: Request, res: Response) {
  const child = await getChildById(req.params.childId!);
  if (!child) return res.status(404).json({ message: "Çocuk profili bulunamadı" });
  return res.json({ success: true, data: child });
}

export async function updateChildHandler(req: Request, res: Response) {
  const parsed = updateChildSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  const child = await updateChild(req.params.childId!, parsed.data);
  return res.json({ success: true, data: child });
}

export async function deleteChildHandler(req: Request, res: Response) {
  await deleteChild(req.params.childId!);
  return res.json({ success: true });
}

// ── Session (PIN) ───────────────────────────────────────────────────────────────

export async function createChildSessionHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const parsed = childSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  try {
    const token = await createChildSession(req.params.childId!, userId, parsed.data.pin_code);
    return res.json({ success: true, token });
  } catch (e: any) {
    if (e.message === "PIN_NOT_SET") return res.status(400).json({ message: "PIN ayarlanmamış" });
    if (e.message === "INVALID_PIN") return res.status(400).json({ message: "Hatalı PIN" });
    return res.status(500).json({ message: "Server error" });
  }
}

export async function setPinHandler(req: Request, res: Response) {
  const parsed = setPinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  await setChildPin(req.params.childId!, parsed.data.pin_code);
  return res.json({ success: true });
}

// ── Tasks ───────────────────────────────────────────────────────────────────────

export async function createTaskHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  const task = await createTask(req.params.childId!, userId, parsed.data);
  return res.status(201).json({ success: true, data: task });
}

export async function getTasksHandler(req: Request, res: Response) {
  const tasks = await getTasks(req.params.childId!);
  return res.json({ success: true, data: tasks });
}

export async function getTaskTemplatesHandler(_req: Request, res: Response) {
  return res.json({ success: true, data: TASK_TEMPLATES });
}

export async function updateTaskHandler(req: Request, res: Response) {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  const task = await updateTask(req.params.taskId!, req.params.childId!, parsed.data);
  if (!task) return res.status(404).json({ message: "Görev bulunamadı" });
  return res.json({ success: true, data: task });
}

export async function deleteTaskHandler(req: Request, res: Response) {
  await deleteTask(req.params.taskId!, req.params.childId!);
  return res.json({ success: true });
}

// ── Completions ─────────────────────────────────────────────────────────────────

export async function getTodayTasksHandler(req: Request, res: Response) {
  const childId = req.childSession?.childId ?? req.params.childId;
  if (!childId) return res.status(400).json({ message: "childId required" });

  const tasks = await getTodayTasksForChild(childId);
  return res.json({ success: true, data: tasks });
}

export async function completeTaskHandler(req: Request, res: Response) {
  const session = req.childSession;
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const parsed = completeTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  try {
    const completion = await completeTask(
      req.params.taskId!,
      session.childId,
      session.parentId,
      parsed.data.evidence_url,
    );
    return res.status(201).json({ success: true, data: completion });
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") return res.status(404).json({ message: "Görev bulunamadı" });
    if (e.message === "ALREADY_COMPLETED") return res.status(409).json({ message: "Bu görev bugün zaten tamamlandı" });
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getCompletionsHandler(req: Request, res: Response) {
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const completions = await getCompletions(req.params.childId!, limit);
  return res.json({ success: true, data: completions });
}

export async function reviewCompletionHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const parsed = reviewCompletionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  try {
    const result = await reviewCompletion(req.params.completionId!, userId, parsed.data.approved, parsed.data.parent_note);
    return res.json({ success: true, data: result });
  } catch {
    return res.status(404).json({ message: "Tamamlama kaydı bulunamadı" });
  }
}

export async function getPendingApprovalsHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const items = await getPendingApprovals(userId);
  return res.json({ success: true, data: items });
}

// ── Stats ────────────────────────────────────────────────────────────────────────

export async function getChildStatsHandler(req: Request, res: Response) {
  const stats = await getChildStats(req.params.childId!);
  return res.json({ success: true, data: stats });
}

export async function getWeeklyReportHandler(req: Request, res: Response) {
  const report = await getWeeklyReport(req.params.childId!);
  return res.json({ success: true, data: report });
}

export async function getMonthlyReportHandler(req: Request, res: Response) {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const report = await getMonthlyReport(req.params.childId!, year, month);
  return res.json({ success: true, data: report });
}

// ── Rewards ──────────────────────────────────────────────────────────────────────

export async function createRewardHandler(req: Request, res: Response) {
  const parsed = createRewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message });

  const reward = await createReward(req.params.childId!, parsed.data.title, parsed.data.cost_stars);
  return res.status(201).json({ success: true, data: reward });
}

export async function getRewardsHandler(req: Request, res: Response) {
  const rewards = await getRewards(req.params.childId!);
  return res.json({ success: true, data: rewards });
}

export async function redeemRewardHandler(req: Request, res: Response) {
  const session = req.childSession;
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  try {
    const result = await redeemReward(req.params.rewardId!, session.childId);
    return res.json({ success: true, data: result });
  } catch (e: any) {
    if (e.message === "REWARD_NOT_FOUND") return res.status(404).json({ message: "Ödül bulunamadı" });
    if (e.message === "INSUFFICIENT_STARS") return res.status(400).json({ message: "Yeterli yıldızın yok" });
    return res.status(500).json({ message: "Server error" });
  }
}

export async function deleteRewardHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  await deleteReward(req.params.rewardId!, userId);
  return res.json({ success: true });
}
