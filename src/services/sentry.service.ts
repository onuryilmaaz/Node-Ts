import * as Sentry from "@sentry/node";

/**
 * Sentry hata izleme. SENTRY_DSN tanımlı değilse tamamen no-op çalışır —
 * yani lokal/test ortamında hiçbir şeyi değiştirmez.
 */
const dsn = process.env.SENTRY_DSN;
export const sentryEnabled = Boolean(dsn);

export function initSentry() {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // Performans örneklemesi — production'da maliyet için düşük tutuldu.
    tracesSampleRate: 0.1,
  });

  console.log("Sentry initialized");
}

/** Hatayı Sentry'ye gönderir; DSN yoksa sessizce geçer. */
export function captureException(err: unknown, context?: Record<string, any>) {
  if (!sentryEnabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
