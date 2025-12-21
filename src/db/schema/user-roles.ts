import { uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { roles } from "./roles";
import { appSchema } from "./app-schema";

export const userRoles = appSchema.table("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
});
