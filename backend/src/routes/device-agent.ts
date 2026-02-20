import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface GetRulesQuery {
  deviceId: string;
}

interface PostReportBody {
  deviceId: string;
  appName: string;
  usageMinutes: number;
  reportedAt: string;
}

interface PostReportResponse {
  success: boolean;
  reportId: string;
}

interface GetReportsQuery {
  deviceId: string;
  startDate?: string;
  endDate?: string;
}

interface RuleResponse {
  id: string;
  ruleType: string;
  targetApp: string | null;
  timeLimit: number | null;
  isActive: boolean;
  createdAt: Date;
}

interface ReportResponse {
  id: string;
  appName: string;
  usageMinutes: number;
  reportedAt: Date;
}

export function registerDeviceAgentRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/device-agent/rules', {
    schema: {
      description: 'Get device rules for a specific device',
      tags: ['device-agent'],
      querystring: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', minLength: 1, description: 'Device ID' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
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
    request: FastifyRequest<{ Querystring: GetRulesQuery }>,
    reply: FastifyReply
  ): Promise<RuleResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId } = request.query;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId }, 'Fetching device rules');

    try {
      const rules = await app.db
        .select({
          id: schema.deviceRules.id,
          ruleType: schema.deviceRules.ruleType,
          targetApp: schema.deviceRules.targetApp,
          timeLimit: schema.deviceRules.timeLimit,
          isActive: schema.deviceRules.isActive,
          createdAt: schema.deviceRules.createdAt,
        })
        .from(schema.deviceRules)
        .where(
          and(
            eq(schema.deviceRules.userId, userId),
            eq(schema.deviceRules.deviceId, deviceId)
          )
        );

      app.logger.info({ userId, deviceId, ruleCount: rules.length }, 'Device rules fetched');
      return rules;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId }, 'Failed to fetch device rules');
      throw error;
    }
  });

  app.fastify.post('/device-agent/report', {
    schema: {
      description: 'Report device usage for an app',
      tags: ['device-agent'],
      body: {
        type: 'object',
        required: ['deviceId', 'appName', 'usageMinutes', 'reportedAt'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
          appName: { type: 'string', description: 'Application name' },
          usageMinutes: { type: 'integer', description: 'Usage time in minutes' },
          reportedAt: { type: 'string', format: 'date-time', description: 'Report timestamp (ISO 8601)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            reportId: { type: 'string', format: 'uuid' },
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
    request: FastifyRequest<{ Body: PostReportBody }>,
    reply: FastifyReply
  ): Promise<PostReportResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId, appName, usageMinutes, reportedAt } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId, appName, usageMinutes }, 'Creating device usage report');

    try {
      const result = await app.db
        .insert(schema.deviceReports)
        .values({
          userId,
          deviceId,
          appName,
          usageMinutes,
          reportedAt: new Date(reportedAt),
        })
        .returning({ id: schema.deviceReports.id });

      const reportId = result[0].id;
      app.logger.info({ userId, deviceId, appName, reportId }, 'Device usage report created');

      return { success: true, reportId };
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId, appName }, 'Failed to create device usage report');
      throw error;
    }
  });

  app.fastify.get('/device-agent/reports', {
    schema: {
      description: 'Get device usage reports',
      tags: ['device-agent'],
      querystring: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', minLength: 1, description: 'Device ID' },
          startDate: { type: 'string', format: 'date-time', description: 'Filter reports from this date (ISO 8601)' },
          endDate: { type: 'string', format: 'date-time', description: 'Filter reports until this date (ISO 8601)' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              appName: { type: 'string' },
              usageMinutes: { type: 'integer' },
              reportedAt: { type: 'string', format: 'date-time' },
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
    request: FastifyRequest<{ Querystring: GetReportsQuery }>,
    reply: FastifyReply
  ): Promise<ReportResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId, startDate, endDate } = request.query;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId, startDate, endDate }, 'Fetching device usage reports');

    try {
      const conditions = [
        eq(schema.deviceReports.userId, userId),
        eq(schema.deviceReports.deviceId, deviceId),
      ];

      if (startDate) {
        conditions.push(gte(schema.deviceReports.reportedAt, new Date(startDate)));
      }

      if (endDate) {
        conditions.push(lte(schema.deviceReports.reportedAt, new Date(endDate)));
      }

      const reports = await app.db
        .select({
          id: schema.deviceReports.id,
          appName: schema.deviceReports.appName,
          usageMinutes: schema.deviceReports.usageMinutes,
          reportedAt: schema.deviceReports.reportedAt,
        })
        .from(schema.deviceReports)
        .where(and(...conditions));

      app.logger.info({ userId, deviceId, reportCount: reports.length }, 'Device usage reports fetched');
      return reports;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId }, 'Failed to fetch device usage reports');
      throw error;
    }
  });
}
