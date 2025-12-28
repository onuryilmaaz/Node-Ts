import { uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { appSchema } from "./app-schema";

export const users = appSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),

  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  avatarPublicId: text("avatar_public_id"),

  authProvider: text("auth_provider").notNull().default("local"),
  providerId: text("provider_id"),

  passwordHash: text("password_hash"),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
