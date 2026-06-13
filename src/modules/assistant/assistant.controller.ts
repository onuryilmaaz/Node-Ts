import type { Request, Response } from "express";
import {
  generateAssistantReply,
  aiEnabled,
  type ChatMessage,
} from "../../services/ai.service";

const MAX_MESSAGES = 20;
const MAX_LEN = 2000;

export async function chatHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });

  if (!aiEnabled) {
    return res.status(503).json({
      success: false,
      message: "AI asistanı şu anda kullanılamıyor.",
    });
  }

  const raw = req.body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "messages dizisi gerekli" });
  }

  // Sanitize: son MAX_MESSAGES mesaj, geçerli rol, uzunluk sınırı.
  const messages: ChatMessage[] = raw
    .slice(-MAX_MESSAGES)
    .filter((m: any) => m && typeof m.text === "string" && m.text.trim())
    .map((m: any) => ({
      role: m.role === "model" ? "model" : "user",
      text: String(m.text).slice(0, MAX_LEN),
    }));

  if (messages.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Geçerli mesaj yok" });
  }

  try {
    const reply = await generateAssistantReply(messages);
    if (!reply) {
      return res.status(502).json({
        success: false,
        message: "Yanıt üretilemedi, lütfen tekrar deneyin.",
      });
    }
    return res.json({ success: true, data: { reply } });
  } catch (err) {
    console.error("Assistant chat error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
