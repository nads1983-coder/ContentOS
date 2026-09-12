import { pgSchema, text, jsonb, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
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
// Owner-seeded, fixed recipient inventory; runtime cannot add recipients or change content.
export const migrationMailCampaign = appSchema.table("migration_mail_campaign", {
  id: text("id").primaryKey(),
  contentHash: text("content_hash").notNull(),
  operatorTokenHash: text("operator_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const migrationMailRecipient = appSchema.table("migration_mail_recipient", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => migrationMailCampaign.id),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  recipientKey: text("recipient_key"),
  status: text("status").notNull(),
  reason: text("reason"),
  attempts: integer("attempts").notNull().default(0),
  providerId: text("provider_id"),
  providerStatus: text("provider_status"),
  firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, t => [
  uniqueIndex("migration_mail_account_once").on(t.campaignId, t.userId),
  uniqueIndex("migration_mail_address_once").on(t.campaignId, t.recipientKey),
  uniqueIndex("migration_mail_provider_once").on(t.providerId)
]);
