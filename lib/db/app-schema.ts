import { pgSchema, text, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";
import type { UserProfile } from "@/types/saas";
export const appSchema = pgSchema("contentos_app");
// Preserve the existing profile shape and embedded collections during migration.
export const profiles = appSchema.table("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  data: jsonb("data").$type<UserProfile & Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const mailDelivery = appSchema.table("mail_delivery", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  providerId: text("provider_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, t => [index("mail_delivery_created_at_idx").on(t.createdAt)]);
export const mailBudget = appSchema.table("mail_budget", {
  period: text("period").primaryKey(),
  count: integer("count").notNull().default(0)
});
