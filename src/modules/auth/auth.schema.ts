import { z } from "zod";
import { passwordSchema } from "../../validators/password.schema";

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const resendEmailOtpSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: passwordSchema,
});

export const changeEmailRequestSchema = z.object({
  newEmail: z.string().email(),
});

export const changeEmailConfirmSchema = z.object({
  otp: z.string().length(6),
});
