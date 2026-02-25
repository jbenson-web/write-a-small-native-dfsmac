import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gt, gte } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CheckInBody {
  deviceId: string;
}

interface UserStatsResponse {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  perfectDays: number;
  lastCheckIn: Date | null;
}

interface AchievementResponse {
  id: string;
  achievementType: string;
  unlockedAt: Date;
  metadata: any;
}

interface RewardResponse {
  id: string;
  rewardType: string;
  rewardName: string;
  rewardDescription: string | null;
  earnedAt: Date;
}

interface CheckInResponse {
  success: boolean;
  pointsEarned: number;
  newAchievements: string[];
  currentStreak: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  currentStreak: number;
}

export function registerGamificationRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Helper function to get or create user stats
  async function getOrCreateUserStats(userId: string) {
    const existing = await app.db
      .select()
      .from(schema.userStats)
      .where(eq(schema.userStats.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const created = await app.db
      .insert(schema.userStats)
      .values({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        perfectDays: 0,
        lastCheckIn: null,
      })
      .returning();

    return created[0];
  }

  // Helper function to check if user followed rules for the day
  async function checkPerfectDay(userId: string, deviceId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reports = await app.db
      .select()
      .from(schema.deviceReports)
      .where(
        and(
          eq(schema.deviceReports.userId, userId),
          eq(schema.deviceReports.deviceId, deviceId),
          gte(schema.deviceReports.reportedAt, today),
          gt(schema.deviceReports.reportedAt, tomorrow)
        )
      );

    if (reports.length === 0) {
      return true;
    }

    const rules = await app.db
      .select()
      .from(schema.deviceRules)
      .where(
        and(
          eq(schema.deviceRules.userId, userId),
          eq(schema.deviceRules.deviceId, deviceId),
          eq(schema.deviceRules.isActive, true)
        )
      );

    if (rules.length === 0) {
      return true;
    }

    for (const report of reports) {
      for (const rule of rules) {
        if (rule.ruleType === 'app_block' && rule.targetApp === report.appName) {
          return false;
        }
        if (rule.ruleType === 'time_limit' && rule.targetApp === report.appName && report.usageMinutes > (rule.timeLimit || 0)) {
          return false;
        }
      }
    }

    return true;
  }

  // Helper function to unlock achievement
  async function unlockAchievement(userId: string, achievementType: string, metadata?: any) {
    const existing = await app.db
      .select()
      .from(schema.achievements)
      .where(
        and(
          eq(schema.achievements.userId, userId),
          eq(schema.achievements.achievementType, achievementType)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await app.db
        .insert(schema.achievements)
        .values({
          userId,
          achievementType,
          unlockedAt: new Date(),
          metadata: metadata || null,
        });
      return true;
    }
    return false;
  }

  app.fastify.get('/api/gamification/stats', {
    schema: {
      description: 'Get user gamification statistics',
      tags: ['gamification'],
      response: {
        200: {
          type: 'object',
          properties: {
            currentStreak: { type: 'integer' },
            longestStreak: { type: 'integer' },
            totalPoints: { type: 'integer' },
            perfectDays: { type: 'integer' },
            lastCheckIn: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<UserStatsResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching gamification stats');

    try {
      const stats = await getOrCreateUserStats(userId);

      const response: UserStatsResponse = {
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        totalPoints: stats.totalPoints,
        perfectDays: stats.perfectDays,
        lastCheckIn: stats.lastCheckIn,
      };

      app.logger.info({ userId, stats: response }, 'Gamification stats fetched');
      return response;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch gamification stats');
      throw error;
    }
  });

  app.fastify.get('/api/gamification/achievements', {
    schema: {
      description: 'Get user achievements',
      tags: ['gamification'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              achievementType: { type: 'string' },
              unlockedAt: { type: 'string', format: 'date-time' },
              metadata: { type: ['object', 'null'] },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AchievementResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching user achievements');

    try {
      const achievements = await app.db
        .select({
          id: schema.achievements.id,
          achievementType: schema.achievements.achievementType,
          unlockedAt: schema.achievements.unlockedAt,
          metadata: schema.achievements.metadata,
        })
        .from(schema.achievements)
        .where(eq(schema.achievements.userId, userId));

      app.logger.info({ userId, count: achievements.length }, 'User achievements fetched');
      return achievements as AchievementResponse[];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user achievements');
      throw error;
    }
  });

  app.fastify.get('/api/gamification/rewards', {
    schema: {
      description: 'Get user rewards',
      tags: ['gamification'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              rewardType: { type: 'string' },
              rewardName: { type: 'string' },
              rewardDescription: { type: ['string', 'null'] },
              earnedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<RewardResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching user rewards');

    try {
      const rewards = await app.db
        .select({
          id: schema.rewards.id,
          rewardType: schema.rewards.rewardType,
          rewardName: schema.rewards.rewardName,
          rewardDescription: schema.rewards.rewardDescription,
          earnedAt: schema.rewards.earnedAt,
        })
        .from(schema.rewards)
        .where(eq(schema.rewards.userId, userId));

      app.logger.info({ userId, count: rewards.length }, 'User rewards fetched');
      return rewards as RewardResponse[];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user rewards');
      throw error;
    }
  });

  app.fastify.post('/api/gamification/check-in', {
    schema: {
      description: 'Check in and process daily streak/points',
      tags: ['gamification'],
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            pointsEarned: { type: 'integer' },
            newAchievements: { type: 'array', items: { type: 'string' } },
            currentStreak: { type: 'integer' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: CheckInBody }>,
    reply: FastifyReply
  ): Promise<CheckInResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId }, 'Processing check-in');

    try {
      const stats = await getOrCreateUserStats(userId);
      const newAchievements: string[] = [];
      let pointsEarned = 0;

      const now = new Date();
      const lastCheckIn = stats.lastCheckIn ? new Date(stats.lastCheckIn) : null;
      const daysSinceLastCheckIn = lastCheckIn
        ? Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let currentStreak = stats.currentStreak;
      let longestStreak = stats.longestStreak;
      let perfectDays = stats.perfectDays;

      if (daysSinceLastCheckIn >= 2) {
        currentStreak = 0;
      }

      const isPerfectDay = await checkPerfectDay(userId, deviceId);

      if (isPerfectDay) {
        pointsEarned += 10;
        perfectDays += 1;
        currentStreak += 1;

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }

        if (currentStreak === 7) {
          pointsEarned += 5;
          const unlocked = await unlockAchievement(userId, 'week_streak', { streak: 7 });
          if (unlocked) {
            newAchievements.push('week_streak');
            await app.db.insert(schema.rewards).values({
              userId,
              rewardType: 'badge',
              rewardName: 'Week Warrior',
              rewardDescription: 'Maintained a 7-day streak',
              earnedAt: now,
            });
          }
        }

        if (currentStreak === 30) {
          pointsEarned += 20;
          const unlocked = await unlockAchievement(userId, 'month_streak', { streak: 30 });
          if (unlocked) {
            newAchievements.push('month_streak');
            await app.db.insert(schema.rewards).values({
              userId,
              rewardType: 'badge',
              rewardName: 'Month Master',
              rewardDescription: 'Maintained a 30-day streak',
              earnedAt: now,
            });
          }
        }

        if (perfectDays === 1) {
          const unlocked = await unlockAchievement(userId, 'first_rule');
          if (unlocked) {
            newAchievements.push('first_rule');
            await app.db.insert(schema.rewards).values({
              userId,
              rewardType: 'badge',
              rewardName: 'Rule Follower',
              rewardDescription: 'Followed all rules for a day',
              earnedAt: now,
            });
          }
        }

        if (perfectDays === 30) {
          const unlocked = await unlockAchievement(userId, 'perfect_day', { perfectDays: 30 });
          if (unlocked) {
            newAchievements.push('perfect_day');
            await app.db.insert(schema.rewards).values({
              userId,
              rewardType: 'badge',
              rewardName: 'Perfect Record',
              rewardDescription: 'Had 30 perfect days',
              earnedAt: now,
            });
          }
        }

        const activeRuleCount = await app.db
          .select()
          .from(schema.deviceRules)
          .where(
            and(
              eq(schema.deviceRules.userId, userId),
              eq(schema.deviceRules.isActive, true)
            )
          );

        if (activeRuleCount.length >= 5) {
          const unlocked = await unlockAchievement(userId, 'rule_master', { activeRules: activeRuleCount.length });
          if (unlocked) {
            newAchievements.push('rule_master');
            await app.db.insert(schema.rewards).values({
              userId,
              rewardType: 'badge',
              rewardName: 'Rule Master',
              rewardDescription: 'Created 5 or more active rules',
              earnedAt: now,
            });
          }
        }
      } else {
        currentStreak = 0;
      }

      const totalPoints = stats.totalPoints + pointsEarned;

      await app.db
        .update(schema.userStats)
        .set({
          currentStreak,
          longestStreak,
          totalPoints,
          perfectDays,
          lastCheckIn: now,
          updatedAt: now,
        })
        .where(eq(schema.userStats.userId, userId));

      app.logger.info(
        { userId, deviceId, pointsEarned, currentStreak, newAchievements },
        'Check-in processed'
      );

      return {
        success: true,
        pointsEarned,
        newAchievements,
        currentStreak,
      };
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId }, 'Failed to process check-in');
      throw error;
    }
  });

  app.fastify.get('/api/gamification/leaderboard', {
    schema: {
      description: 'Get top 10 users by points',
      tags: ['gamification'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              userName: { type: 'string' },
              totalPoints: { type: 'integer' },
              currentStreak: { type: 'integer' },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<LeaderboardEntry[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({}, 'Fetching leaderboard');

    try {
      const topUsers = await app.db
        .select({
          userId: schema.userStats.userId,
          totalPoints: schema.userStats.totalPoints,
          currentStreak: schema.userStats.currentStreak,
        })
        .from(schema.userStats)
        .orderBy(desc(schema.userStats.totalPoints))
        .limit(10);

      const leaderboard: LeaderboardEntry[] = topUsers.map((user, index) => ({
        userId: user.userId,
        userName: `User #${index + 1}`,
        totalPoints: user.totalPoints,
        currentStreak: user.currentStreak,
      }));

      app.logger.info({ count: leaderboard.length }, 'Leaderboard fetched');
      return leaderboard;
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch leaderboard');
      throw error;
    }
  });
}
