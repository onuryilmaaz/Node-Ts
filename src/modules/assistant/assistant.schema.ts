import { z } from "zod";

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]).optional(),
        text: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(50),
});
