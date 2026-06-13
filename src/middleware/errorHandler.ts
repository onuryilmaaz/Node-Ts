import type { Request, Response, NextFunction } from "express";
import { captureException } from "../services/sentry.service";

/**
 * Async controller'ları sarmalar; içeride fırlatılan/reject olan hataları
 * otomatik olarak errorHandler'a iletir. Kullanım:
 *   router.get("/x", asyncHandler(controller))
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Hiçbir route ile eşleşmeyen istekler için 404. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: "Not found", path: req.originalUrl });
}

/**
 * Merkezi hata yakalayıcı — güvenlik ağı. Controller'larda yakalanmayan
 * hataları yakalar, Sentry'ye raporlar ve temiz bir 500 döndürür.
 * Production'da stack trace sızdırmaz.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  // Yanıt başlıkları zaten gönderildiyse Express'in varsayılanına devret.
  if (res.headersSent) return;

  const status = err?.status || err?.statusCode || 500;

  // Sadece beklenmeyen (5xx) hataları Sentry'ye ve log'a gönder.
  if (status >= 500) {
    captureException(err, { path: req.originalUrl, method: req.method });
    console.error("Unhandled error:", err);
  }

  const isDev = (process.env.NODE_ENV || "development") !== "production";
  res.status(status).json({
    message: err?.message || "Internal server error",
    ...(isDev && err?.stack ? { stack: err.stack } : {}),
  });
}
