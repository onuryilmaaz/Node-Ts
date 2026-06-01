import type { Request, Response } from "express";
import { listHifz, upsertHifz, deleteHifz } from "./hifz.service";

export async function listHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  try {
    const data = await listHifz(userId);
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false });
  }
}

export async function upsertHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  const { surah_id, status, pages_done } = req.body;
  if (!surah_id || !status) {
    return res.status(400).json({ success: false, message: "surah_id ve status gerekli" });
  }
  try {
    const row = await upsertHifz(
      userId,
      Number(surah_id),
      String(status),
      Number(pages_done ?? 0),
    );
    return res.json({ success: true, data: row });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
}

export async function deleteHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  const { surah_id } = req.params;
  try {
    await deleteHifz(userId, Number(surah_id));
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false });
  }
}
