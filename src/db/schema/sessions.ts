import { uuid, text, timestamp } from "drizzle-orm/pg-core";
import { appSchema } from "./app-schema";
import { users } from "./users";

export const sessions = appSchema.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  refreshTokenHash: text("refresh_token_hash").notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
