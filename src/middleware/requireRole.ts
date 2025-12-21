import type { Request, Response, NextFunction } from "express";

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roles = req.user.roles;

    if (!roles || !roles.includes("admin")) {
      return res.status(403).json({
        message: "Unauthorized",
        requiredRole: role,
      });
    }

    return next();
  };
}
