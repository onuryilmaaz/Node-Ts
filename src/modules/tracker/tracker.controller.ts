import type { Request, Response } from "express";
import {
  logActivity,
  updateLog,
  deleteLog,
  getTodayLogs,
  getLogsForDate,
  getWeeklyStats,
  getMonthlyStats,
} from "./tracker.service";

const VALID_TYPES = ["quran", "dhikr", "nafile", "fasting", "sadaka", "dua", "memorization"];

export async function logActivityHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { activity_type, value, notes, date } = req.body;

    if (!activity_type || !VALID_TYPES.includes(activity_type)) {
      return res.status(400).json({ success: false, message: "Geçersiz aktivite türü" });
    }
    if (!value || typeof value !== "object") {
      return res.status(400).json({ success: false, message: "value alanı gereklidir" });
    }

    const log = await logActivity(userId, activity_type, value, notes, date);
    return res.status(201).json({ success: true, data: log });
  } catch (err) {
    console.error("Log activity error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateLogHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { value, notes } = req.body;

    if (!value || typeof value !== "object") {
      return res.status(400).json({ success: false, message: "value alanı gereklidir" });
    }

    const log = await updateLog(userId, id!, value, notes);
    if (!log) return res.status(404).json({ success: false, message: "Kayıt bulunamadı" });

    return res.json({ success: true, data: log });
  } catch (err) {
    console.error("Update log error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteLogHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    await deleteLog(userId, id!);
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete log error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getTodayLogsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const logs = await getTodayLogs(userId);
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error("Get today logs error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getDateLogsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { date } = req.params;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Geçersiz tarih formatı (YYYY-MM-DD)" });
    }

    const logs = await getLogsForDate(userId, date!);
    return res.json({ success: true, data: logs });
  } catch (err) {
    console.error("Get date logs error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getWeeklyStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const stats = await getWeeklyStats(userId);
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error("Get weekly stats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getMonthlyStatsHandler(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    const stats = await getMonthlyStats(userId, year, month);
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error("Get monthly stats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
