import type { Request, Response } from "express";
import {
  changePassword,
  deactivateAccount,
  getUserProfile,
  updateUserProfile,
  uploadAvatarService,
} from "./user.service";
import { db } from "../../db";
import { changePasswordSchema, updateProfileSchema } from "./user.schema";
import { query } from "../../db";
import Expo from "expo-server-sdk";

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

export async function savePushToken(req: Request, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ success: false });

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, message: "Token gerekli." });
    }
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ success: false, message: "Geçersiz push token." });
    }

    await query(
      `UPDATE app.users SET expo_push_token = $1 WHERE id = $2`,
      [token, req.user.userId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("save push token:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function exportUserData(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const safe = <T,>(p: Promise<T>): Promise<T | { rows: any[] }> =>
      p.catch((e) => {
        console.error("export query failed:", (e as any)?.message);
        return { rows: [] };
      });

    const [
      profile, prayerLogs, kazaQueue, kazaCounters,
      trackerLogs, hifz, goals, ozelGun, stats,
    ] = await Promise.all([
      safe(db.execute(`SELECT id, email, username, first_name, last_name, phone, avatar_url, gender, created_at FROM app.users WHERE id = $1`, [userId])),
      safe(db.execute(`SELECT date::text, prayer_time, is_kaza, points_earned, created_at FROM app.prayer_logs WHERE user_id = $1 ORDER BY date ASC, created_at ASC`, [userId])),
      safe(db.execute(`SELECT id, prayer_time, missed_date::text, completed_at, created_at FROM app.kaza_queue WHERE user_id = $1 ORDER BY missed_date DESC`, [userId])),
      safe(db.execute(`SELECT * FROM app.kaza_counters WHERE user_id = $1`, [userId])),
      safe(db.execute(`SELECT id, date::text, activity_type, value, notes, created_at FROM app.tracker_logs WHERE user_id = $1 ORDER BY date ASC, created_at ASC`, [userId])),
      safe(db.execute(`SELECT surah_id, status, pages_done, updated_at FROM app.user_hifz WHERE user_id = $1 ORDER BY surah_id ASC`, [userId])),
      safe(db.execute(`SELECT activity_type, target, enabled, updated_at FROM app.user_goals WHERE user_id = $1`, [userId])),
      safe(db.execute(`SELECT start_date::text, end_date::text, created_at FROM app.ozel_gun_periods WHERE user_id = $1 ORDER BY start_date DESC`, [userId])),
      safe(db.execute(`SELECT * FROM app.user_stats WHERE user_id = $1`, [userId])),
    ]);

    return res.json({
      success: true,
      exported_at: new Date().toISOString(),
      app: "Salah",
      version: 1,
      data: {
        profile: (profile as any).rows[0] ?? null,
        stats: (stats as any).rows[0] ?? null,
        prayer_logs: (prayerLogs as any).rows,
        kaza_queue: (kazaQueue as any).rows,
        kaza_counters: (kazaCounters as any).rows[0] ?? null,
        tracker_logs: (trackerLogs as any).rows,
        hifz: (hifz as any).rows,
        goals: (goals as any).rows,
        ozel_gun_periods: (ozelGun as any).rows,
      },
    });
  } catch (err) {
    console.error("Export user data error:", err);
    return res.status(500).json({ success: false, message: "Veri dışa aktarılamadı" });
  }
}
