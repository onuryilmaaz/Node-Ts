import rateLimit from "express-rate-limit";

// Standart 429 yanıtı — projedeki { message } JSON şekline uyumlu.
const handler = (_req: any, res: any) =>
  res.status(429).json({
    message: "Çok fazla deneme yaptınız. Lütfen bir süre sonra tekrar deneyin.",
  });

const common = {
  standardHeaders: true, // RateLimit-* başlıklarını döndür
  legacyHeaders: false, // X-RateLimit-* başlıklarını kapat
  handler,
};

/**
 * Giriş / kayıt gibi kimlik bilgisi doğrulayan uçlar için.
 * Brute-force'a karşı IP başına 15 dakikada 10 deneme.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  ...common,
});

/**
 * E-posta/OTP gönderen uçlar için (doğrulama, şifre sıfırlama).
 * Spam ve e-posta maliyetine karşı IP başına 15 dakikada 5 istek.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  ...common,
});
