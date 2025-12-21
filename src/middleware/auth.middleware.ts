import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({
      message: "Authorization header missing",
    });

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token)
    return res.status(401).json({
      message: "Invalid authorization format",
    });

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
