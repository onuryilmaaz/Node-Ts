import { uuid, text } from "drizzle-orm/pg-core";
import { appSchema } from "./app-schema";

export const roles = appSchema.table("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // user, admin
});
