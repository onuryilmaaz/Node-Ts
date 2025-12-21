import { timestamp, uuid, text } from "drizzle-orm/pg-core";
import { appSchema } from "./app-schema";
import { users } from "./users";

export const otpTypeEnum = appSchema.enum("otp_type", [
  "email_verify",
  "password_reset",
  "email_change",
]);

export const otps = appSchema.table("otps", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  otpHash: text("otp_hash").notNull(),

  type: otpTypeEnum("type").notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  usedAt: timestamp("used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
