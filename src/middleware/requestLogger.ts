import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Her isteği sonuçlandığında loglar: method, path, status, süre(ms).
 * Yavaş sorgu ve 4xx/5xx izlemeyi kolaylaştırır.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
