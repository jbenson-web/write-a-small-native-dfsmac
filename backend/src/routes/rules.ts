import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CreateRuleBody {
  deviceId: string;
  ruleType: 'screen_lock' | 'app_block' | 'time_limit';
  targetApp?: string;
  timeLimit?: number;
  isActive: boolean;
}

interface UpdateRuleBody {
  ruleType?: 'screen_lock' | 'app_block' | 'time_limit';
  targetApp?: string;
  timeLimit?: number;
  isActive?: boolean;
}

interface RuleResponse {
  id: string;
  deviceId: string;
  ruleType: string;
  targetApp: string | null;
  timeLimit: number | null;
  isActive: boolean;
  createdAt: Date;
}

interface DeleteResponse {
  success: boolean;
}

export function registerRulesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/rules', {
    schema: {
      description: 'Get all rules for the authenticated user',
      tags: ['rules'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              deviceId: { type: 'string' },
              ruleType: { type: 'string' },
              targetApp: { type: ['string', 'null'] },
              timeLimit: { type: ['integer', 'null'] },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
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
  ): Promise<RuleResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching all rules for user');

    try {
      const rules = await app.db
        .select({
          id: schema.deviceRules.id,
          deviceId: schema.deviceRules.deviceId,
          ruleType: schema.deviceRules.ruleType,
          targetApp: schema.deviceRules.targetApp,
          timeLimit: schema.deviceRules.timeLimit,
          isActive: schema.deviceRules.isActive,
          createdAt: schema.deviceRules.createdAt,
        })
        .from(schema.deviceRules)
        .where(eq(schema.deviceRules.userId, userId));

      app.logger.info({ userId, ruleCount: rules.length }, 'User rules fetched');
      return rules as RuleResponse[];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user rules');
      throw error;
    }
  });

  app.fastify.get('/api/rules/:id', {
    schema: {
      description: 'Get a single rule by ID',
      tags: ['rules'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Rule ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            deviceId: { type: 'string' },
            ruleType: { type: 'string' },
            targetApp: { type: ['string', 'null'] },
            timeLimit: { type: ['integer', 'null'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<RuleResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;

    app.logger.info({ userId, ruleId: id }, 'Fetching rule');

    try {
      const rule = await app.db
        .select({
          id: schema.deviceRules.id,
          userId: schema.deviceRules.userId,
          deviceId: schema.deviceRules.deviceId,
          ruleType: schema.deviceRules.ruleType,
          targetApp: schema.deviceRules.targetApp,
          timeLimit: schema.deviceRules.timeLimit,
          isActive: schema.deviceRules.isActive,
          createdAt: schema.deviceRules.createdAt,
        })
        .from(schema.deviceRules)
        .where(eq(schema.deviceRules.id, id))
        .limit(1);

      if (rule.length === 0) {
        app.logger.warn({ userId, ruleId: id }, 'Rule not found');
        return reply.code(404).send({ error: 'Rule not found' });
      }

      if (rule[0].userId !== userId) {
        app.logger.warn({ userId, ruleId: id, ownerId: rule[0].userId }, 'Unauthorized rule access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      app.logger.info({ ruleId: id, userId }, 'Rule fetched');
      const { userId: _, ...ruleData } = rule[0];
      return ruleData as RuleResponse;
    } catch (error) {
      app.logger.error({ err: error, userId, ruleId: id }, 'Failed to fetch rule');
      throw error;
    }
  });

  app.fastify.post('/api/rules', {
    schema: {
      description: 'Create a new rule',
      tags: ['rules'],
      body: {
        type: 'object',
        required: ['deviceId', 'ruleType', 'isActive'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
          ruleType: { type: 'string', enum: ['screen_lock', 'app_block', 'time_limit'], description: 'Type of rule' },
          targetApp: { type: 'string', description: 'Target application (for app_block rules)' },
          timeLimit: { type: 'integer', description: 'Time limit in minutes (for time_limit rules)' },
          isActive: { type: 'boolean', description: 'Whether the rule is active' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            deviceId: { type: 'string' },
            ruleType: { type: 'string' },
            targetApp: { type: ['string', 'null'] },
            timeLimit: { type: ['integer', 'null'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
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
    request: FastifyRequest<{ Body: CreateRuleBody }>,
    reply: FastifyReply
  ): Promise<RuleResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId, ruleType, targetApp, timeLimit, isActive } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId, ruleType }, 'Creating rule');

    try {
      const result = await app.db
        .insert(schema.deviceRules)
        .values({
          userId,
          deviceId,
          ruleType,
          targetApp: targetApp || null,
          timeLimit: timeLimit || null,
          isActive,
        })
        .returning({
          id: schema.deviceRules.id,
          deviceId: schema.deviceRules.deviceId,
          ruleType: schema.deviceRules.ruleType,
          targetApp: schema.deviceRules.targetApp,
          timeLimit: schema.deviceRules.timeLimit,
          isActive: schema.deviceRules.isActive,
          createdAt: schema.deviceRules.createdAt,
        });

      const rule = result[0] as RuleResponse;
      app.logger.info({ ruleId: rule.id, userId, deviceId }, 'Rule created');
      return rule;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId, ruleType }, 'Failed to create rule');
      throw error;
    }
  });

  app.fastify.put('/api/rules/:id', {
    schema: {
      description: 'Update a rule',
      tags: ['rules'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Rule ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          ruleType: { type: 'string', enum: ['screen_lock', 'app_block', 'time_limit'], description: 'Type of rule' },
          targetApp: { type: 'string', description: 'Target application' },
          timeLimit: { type: 'integer', description: 'Time limit in minutes' },
          isActive: { type: 'boolean', description: 'Whether the rule is active' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            deviceId: { type: 'string' },
            ruleType: { type: 'string' },
            targetApp: { type: ['string', 'null'] },
            timeLimit: { type: ['integer', 'null'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateRuleBody }>,
    reply: FastifyReply
  ): Promise<RuleResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { ruleType, targetApp, timeLimit, isActive } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, ruleId: id }, 'Updating rule');

    try {
      const rule = await app.db
        .select()
        .from(schema.deviceRules)
        .where(eq(schema.deviceRules.id, id))
        .limit(1);

      if (rule.length === 0) {
        app.logger.warn({ userId, ruleId: id }, 'Rule not found');
        return reply.code(404).send({ error: 'Rule not found' });
      }

      if (rule[0].userId !== userId) {
        app.logger.warn({ userId, ruleId: id, ownerId: rule[0].userId }, 'Unauthorized rule access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      const updateData: any = {};
      if (ruleType !== undefined) updateData.ruleType = ruleType;
      if (targetApp !== undefined) updateData.targetApp = targetApp;
      if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
      if (isActive !== undefined) updateData.isActive = isActive;

      const result = await app.db
        .update(schema.deviceRules)
        .set(updateData)
        .where(eq(schema.deviceRules.id, id))
        .returning({
          id: schema.deviceRules.id,
          deviceId: schema.deviceRules.deviceId,
          ruleType: schema.deviceRules.ruleType,
          targetApp: schema.deviceRules.targetApp,
          timeLimit: schema.deviceRules.timeLimit,
          isActive: schema.deviceRules.isActive,
          createdAt: schema.deviceRules.createdAt,
        });

      const updatedRule = result[0] as RuleResponse;
      app.logger.info({ ruleId: id, userId }, 'Rule updated');
      return updatedRule;
    } catch (error) {
      app.logger.error({ err: error, userId, ruleId: id }, 'Failed to update rule');
      throw error;
    }
  });

  app.fastify.delete('/api/rules/:id', {
    schema: {
      description: 'Delete a rule',
      tags: ['rules'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Rule ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<DeleteResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;

    app.logger.info({ userId, ruleId: id }, 'Deleting rule');

    try {
      const rule = await app.db
        .select()
        .from(schema.deviceRules)
        .where(eq(schema.deviceRules.id, id))
        .limit(1);

      if (rule.length === 0) {
        app.logger.warn({ userId, ruleId: id }, 'Rule not found');
        return reply.code(404).send({ error: 'Rule not found' });
      }

      if (rule[0].userId !== userId) {
        app.logger.warn({ userId, ruleId: id, ownerId: rule[0].userId }, 'Unauthorized rule access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      await app.db
        .delete(schema.deviceRules)
        .where(eq(schema.deviceRules.id, id));

      app.logger.info({ ruleId: id, userId }, 'Rule deleted');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId, ruleId: id }, 'Failed to delete rule');
      throw error;
    }
  });
}
