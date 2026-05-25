import type { Request, Response, NextFunction } from "express";
import { verifyChildToken } from "../utils/jwt";
import { query } from "../db";

declare global {
  namespace Express {
    interface Request {
      childSession?: { childId: string; parentId: string };
    }
  }
}

export function requireChildSession(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Authorization header missing" });

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token)
    return res.status(401).json({ message: "Invalid authorization format" });

  try {
    const payload = verifyChildToken(token);
    req.childSession = { childId: payload.childId, parentId: payload.parentId };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired child session" });
  }
}

export function requireParentOf(paramName = "childId") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const childId = req.params[paramName];
    if (!childId) return res.status(400).json({ message: "childId required" });

    const result = await query(
      `SELECT id FROM app.child_profiles WHERE id = $1 AND parent_id = $2 AND is_active = true`,
      [childId, userId],
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Çocuk profili bulunamadı" });

    next();
  };
}
