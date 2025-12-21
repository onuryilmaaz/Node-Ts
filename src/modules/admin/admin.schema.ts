import { z } from "zod";

export const adminUserIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;
