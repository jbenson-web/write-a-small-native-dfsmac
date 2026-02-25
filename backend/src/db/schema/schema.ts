import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name'),
  platform: text('platform'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  achievementType: text('achievement_type').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata'),
});

export const userStats = pgTable('user_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  totalPoints: integer('total_points').default(0).notNull(),
  perfectDays: integer('perfect_days').default(0).notNull(),
  lastCheckIn: timestamp('last_check_in', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rewards = pgTable('rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardName: text('reward_name').notNull(),
  rewardDescription: text('reward_description'),
  earnedAt: timestamp('earned_at', { withTimezone: true }).notNull(),
});
