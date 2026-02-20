import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const deviceRules = pgTable('device_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  deviceId: text('device_id').notNull(),
  ruleType: text('rule_type').notNull(),
  targetApp: text('target_app'),
  timeLimit: integer('time_limit'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deviceReports = pgTable('device_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  deviceId: text('device_id').notNull(),
  appName: text('app_name').notNull(),
  usageMinutes: integer('usage_minutes').notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
