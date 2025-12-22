import { z } from "zod";

export const adminUserIdParamSchema = z.object({
  userId: z.string().uuid(),
});
export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z_]+$/, "Role name must be lowercase and snake_case"),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z_]+$/, "Role name must be lowercase snake_case"),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});
