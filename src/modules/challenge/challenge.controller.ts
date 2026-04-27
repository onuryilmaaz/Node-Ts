import type { Request, Response } from "express";
import {
  getActiveChallenges,
  joinChallenge,
  getUserChallengeHistory,
} from "./challenge.service";

export async function listChallenges(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const challenges = await getActiveChallenges(userId);
    return res.json({ success: true, data: challenges });
  } catch (err) {
    console.error("Challenge list error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function join(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "Challenge ID gerekli." });

    const result = await joinChallenge(userId, id);

    if (result.alreadyJoined) {
      return res.status(400).json({ success: false, message: "Bu challenge'a zaten katıldınız." });
    }

    return res.status(201).json({ success: true, data: result.row });
  } catch (err) {
    console.error("Join challenge error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function history(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const data = await getUserChallengeHistory(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Challenge history error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
