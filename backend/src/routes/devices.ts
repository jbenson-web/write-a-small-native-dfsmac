import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, sum, count } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface RegisterDeviceBody {
  deviceId: string;
  name?: string;
  platform?: 'ios' | 'android' | 'web';
}

interface UpdateDeviceBody {
  name?: string;
}

interface DeviceResponse {
  id: string;
  userId: string;
  name: string | null;
  platform: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

interface DeviceStatsResponse {
  deviceId: string;
  totalReports: number;
  totalUsageMinutes: number;
  activeRules: number;
  lastReportAt: Date | null;
}

interface DeleteResponse {
  success: boolean;
}

export function registerDevicesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.post('/api/devices/register', {
    schema: {
      description: 'Register or update a device for the authenticated user',
      tags: ['devices'],
      body: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', description: 'Unique device identifier' },
          name: { type: 'string', description: 'User-friendly device name' },
          platform: { type: 'string', enum: ['ios', 'android', 'web'], description: 'Device platform' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: ['string', 'null'] },
            platform: { type: ['string', 'null'] },
            lastSeenAt: { type: 'string', format: 'date-time' },
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
    request: FastifyRequest<{ Body: RegisterDeviceBody }>,
    reply: FastifyReply
  ): Promise<DeviceResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { deviceId, name, platform } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId, name, platform }, 'Registering or updating device');

    try {
      const now = new Date();
      const existingDevice = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, deviceId))
        .limit(1);

      let device: DeviceResponse;

      if (existingDevice.length > 0) {
        const existing = existingDevice[0];
        if (existing.userId !== userId) {
          app.logger.warn({ userId, deviceId, ownerId: existing.userId }, 'Device owned by different user');
          return reply.code(403).send({ error: 'Device owned by different user' });
        }

        const updated = await app.db
          .update(schema.devices)
          .set({
            lastSeenAt: now,
            ...(name !== undefined && { name }),
            ...(platform !== undefined && { platform }),
          })
          .where(eq(schema.devices.id, deviceId))
          .returning();

        device = updated[0] as DeviceResponse;
        app.logger.info({ deviceId, userId }, 'Device updated');
      } else {
        const inserted = await app.db
          .insert(schema.devices)
          .values({
            id: deviceId,
            userId,
            name: name || null,
            platform: platform || null,
            lastSeenAt: now,
          })
          .returning();

        device = inserted[0] as DeviceResponse;
        app.logger.info({ deviceId, userId }, 'Device registered');
      }

      return device;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId }, 'Failed to register device');
      throw error;
    }
  });

  app.fastify.get('/api/devices', {
    schema: {
      description: 'Get all devices for the authenticated user',
      tags: ['devices'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              name: { type: ['string', 'null'] },
              platform: { type: ['string', 'null'] },
              lastSeenAt: { type: 'string', format: 'date-time' },
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
  ): Promise<DeviceResponse[] | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Fetching user devices');

    try {
      const devices = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.userId, userId))
        .orderBy(desc(schema.devices.lastSeenAt));

      app.logger.info({ userId, deviceCount: devices.length }, 'User devices fetched');
      return devices as DeviceResponse[];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user devices');
      throw error;
    }
  });

  app.fastify.put('/api/devices/:id', {
    schema: {
      description: 'Update device information',
      tags: ['devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Device ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'User-friendly device name' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: ['string', 'null'] },
            platform: { type: ['string', 'null'] },
            lastSeenAt: { type: 'string', format: 'date-time' },
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
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateDeviceBody }>,
    reply: FastifyReply
  ): Promise<DeviceResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const { name } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId: id, name }, 'Updating device');

    try {
      const device = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, id))
        .limit(1);

      if (device.length === 0) {
        app.logger.warn({ userId, deviceId: id }, 'Device not found');
        return reply.code(404).send({ error: 'Device not found' });
      }

      if (device[0].userId !== userId) {
        app.logger.warn({ userId, deviceId: id, ownerId: device[0].userId }, 'Unauthorized device access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      const updated = await app.db
        .update(schema.devices)
        .set({
          ...(name !== undefined && { name }),
        })
        .where(eq(schema.devices.id, id))
        .returning();

      app.logger.info({ deviceId: id, userId }, 'Device updated');
      return updated[0] as DeviceResponse;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId: id }, 'Failed to update device');
      throw error;
    }
  });

  app.fastify.delete('/api/devices/:id', {
    schema: {
      description: 'Delete a device and all associated rules and reports',
      tags: ['devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Device ID' },
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

    app.logger.info({ userId, deviceId: id }, 'Deleting device');

    try {
      const device = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, id))
        .limit(1);

      if (device.length === 0) {
        app.logger.warn({ userId, deviceId: id }, 'Device not found');
        return reply.code(404).send({ error: 'Device not found' });
      }

      if (device[0].userId !== userId) {
        app.logger.warn({ userId, deviceId: id, ownerId: device[0].userId }, 'Unauthorized device access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      const deviceIdFromDb = device[0].id;

      await app.db
        .delete(schema.deviceRules)
        .where(eq(schema.deviceRules.deviceId, deviceIdFromDb));

      await app.db
        .delete(schema.deviceReports)
        .where(eq(schema.deviceReports.deviceId, deviceIdFromDb));

      await app.db
        .delete(schema.devices)
        .where(eq(schema.devices.id, id));

      app.logger.info({ deviceId: id, userId }, 'Device deleted with all associated rules and reports');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId: id }, 'Failed to delete device');
      throw error;
    }
  });

  app.fastify.get('/api/devices/:id/stats', {
    schema: {
      description: 'Get usage statistics for a specific device',
      tags: ['devices'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Device ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            totalReports: { type: 'integer' },
            totalUsageMinutes: { type: 'integer' },
            activeRules: { type: 'integer' },
            lastReportAt: { type: ['string', 'null'], format: 'date-time' },
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
  ): Promise<DeviceStatsResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id } = request.params;
    const userId = session.user.id;

    app.logger.info({ userId, deviceId: id }, 'Fetching device stats');

    try {
      const device = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, id))
        .limit(1);

      if (device.length === 0) {
        app.logger.warn({ userId, deviceId: id }, 'Device not found');
        return reply.code(404).send({ error: 'Device not found' });
      }

      if (device[0].userId !== userId) {
        app.logger.warn({ userId, deviceId: id, ownerId: device[0].userId }, 'Unauthorized device access');
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      const reportStats = await app.db
        .select({
          totalReports: count(),
          totalUsageMinutes: sum(schema.deviceReports.usageMinutes),
        })
        .from(schema.deviceReports)
        .where(eq(schema.deviceReports.deviceId, id));

      const ruleStats = await app.db
        .select({
          activeRules: count(),
        })
        .from(schema.deviceRules)
        .where(
          and(
            eq(schema.deviceRules.deviceId, id),
            eq(schema.deviceRules.isActive, true)
          )
        );

      const reports = await app.db
        .select({ reportedAt: schema.deviceReports.reportedAt })
        .from(schema.deviceReports)
        .where(eq(schema.deviceReports.deviceId, id))
        .orderBy(desc(schema.deviceReports.reportedAt))
        .limit(1);

      const totalUsageMinutes = reportStats[0].totalUsageMinutes ? Number(reportStats[0].totalUsageMinutes) : 0;

      const stats: DeviceStatsResponse = {
        deviceId: id,
        totalReports: reportStats[0].totalReports || 0,
        totalUsageMinutes: totalUsageMinutes,
        activeRules: ruleStats[0].activeRules || 0,
        lastReportAt: reports.length > 0 ? reports[0].reportedAt : null,
      };

      app.logger.info({ deviceId: id, userId, ...stats }, 'Device stats fetched');
      return stats;
    } catch (error) {
      app.logger.error({ err: error, userId, deviceId: id }, 'Failed to fetch device stats');
      throw error;
    }
  });
}
