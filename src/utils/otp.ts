import crypto from "crypto";

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function otpExpiresAt(minutes: 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
