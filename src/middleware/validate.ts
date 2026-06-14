import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * req.body'yi verilen Zod şemasına göre doğrular.
 * Hata → 400 + ayrıntılı issue listesi. Başarı → ayrıştırılmış veriyi
 * req.body'ye yazar (coercion/temizleme için) ve devam eder.
 *
 * Kullanım: router.post("/x", validate(xSchema), controller)
 */
export const validate =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz istek",
        errors: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    return next();
  };
