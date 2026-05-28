import type { Request, Response } from "express";
import { getActivePeriod, startPeriod, endPeriod } from "./ozel_gun.service";
import { query } from "../../db";

export async function getActive(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const genderRes = await query(
    `SELECT gender FROM app.users WHERE id = $1`,
    [req.user.userId],
  );
  const gender = genderRes.rows[0]?.gender ?? null;

  const period = await getActivePeriod(req.user.userId);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const todayIsOzelGun = period !== null;

  res.json({ success: true, data: { gender, isActive: todayIsOzelGun, todayIsOzelGun, period } });
}

export async function start(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const genderRes = await query(
    `SELECT gender FROM app.users WHERE id = $1`,
    [req.user.userId],
  );
  if (genderRes.rows[0]?.gender !== "kadin") {
    return res.status(403).json({ message: "Bu özellik yalnızca kadın kullanıcılara açıktır." });
  }

  const period = await startPeriod(req.user.userId);
  res.json({ success: true, data: period });
}

export async function end(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const period = await endPeriod(req.user.userId);
  if (!period) return res.status(404).json({ message: "Aktif dönem bulunamadı." });

  res.json({ success: true, data: period });
}
