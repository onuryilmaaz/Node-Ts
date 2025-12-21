import type { Request, Response, NextFunction } from "express";

export function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (!req.user.emailVerified)
    return res.status(403).json({
      message: "Email verification required",
    });

  next();
}
