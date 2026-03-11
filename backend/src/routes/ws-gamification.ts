import type { App } from '../index.js';
import { WebSocket } from 'ws';
import { eq, desc, count, isNotNull } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface ClientConnection {
  socket: WebSocket;
  userId: string;
  channels: Set<string>;
}

interface WsMessage {
  type: string;
  channels?: string[];
  data?: any;
}

// Track all connected clients
const connectedClients = new Map<string, Set<ClientConnection>>();

// Broadcast to a specific user
export async function broadcastToUser(userId: string, message: any) {
  const userConnections = connectedClients.get(userId);
  if (!userConnections) return;

  const jsonMessage = JSON.stringify(message);
  for (const client of userConnections) {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(jsonMessage);
    }
  }
}

// Broadcast to all connected users
export async function broadcastToAll(message: any) {
  const jsonMessage = JSON.stringify(message);
  for (const connections of connectedClients.values()) {
    for (const client of connections) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(jsonMessage);
      }
    }
  }
}

// Get count of active users (who have checked in at least once)
export async function getActiveUsersCount(app: App): Promise<number> {
  const result = await app.db
    .select({ total: count() })
    .from(schema.userStats)
    .where(isNotNull(schema.userStats.lastCheckIn));

  return result[0]?.total || 0;
}

export function registerWebSocketGamification(app: App) {
  app.fastify.route({
    method: 'GET',
    url: '/ws/gamification',
    schema: {
      description: 'WebSocket endpoint for real-time gamification updates. Send bearer token as first message to authenticate.',
      tags: ['websocket'],
    },
    wsHandler: (socket, request) => {
      let session: { user: { id: string; email: string } } | null = null;
      let clientConnection: ClientConnection | null = null;
      let keepAliveInterval: NodeJS.Timeout | null = null;

      socket.on('message', async (raw) => {
        try {
          const messageStr = raw.toString();

          // First message must be the bearer token
          if (!session) {
            session = await app.authenticateWsToken(messageStr);
            if (!session) {
              socket.send(JSON.stringify({ error: 'Unauthorized' }));
              socket.close();
              return;
            }

            // Register the client
            const userId = session.user.id;
            clientConnection = {
              socket,
              userId,
              channels: new Set(['stats', 'achievements', 'leaderboard']),
            };

            if (!connectedClients.has(userId)) {
              connectedClients.set(userId, new Set());
            }
            connectedClients.get(userId)!.add(clientConnection);

            app.logger.info({ userId }, 'WebSocket client authenticated');
            socket.send(JSON.stringify({ type: 'authenticated', userId }));

            // Start keepalive ping
            keepAliveInterval = setInterval(() => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'ping' }));
              }
            }, 30000);

            return;
          }

          // Subsequent messages — parse as JSON
          const message: WsMessage = JSON.parse(messageStr);

          if (message.type === 'subscribe' && message.channels) {
            if (clientConnection) {
              clientConnection.channels = new Set(message.channels);
              app.logger.info({ userId: session.user.id, channels: message.channels }, 'Client subscribed to channels');
            }
          } else if (message.type === 'pong') {
            // Keepalive response
            app.logger.debug({ userId: session.user.id }, 'Received pong');
          }
        } catch (error) {
          app.logger.error({ err: error }, 'WebSocket message processing error');
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
        }
      });

      socket.on('close', () => {
        if (clientConnection) {
          const userId = clientConnection.userId;
          const userConnections = connectedClients.get(userId);
          if (userConnections) {
            userConnections.delete(clientConnection);
            if (userConnections.size === 0) {
              connectedClients.delete(userId);
            }
          }
          app.logger.info({ userId }, 'WebSocket client disconnected');
        }

        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
      });

      socket.on('error', (error) => {
        app.logger.error({ err: error }, 'WebSocket error');
      });
    },
    handler: async (request, reply) => {
      return { protocol: 'ws', path: '/ws/gamification' };
    },
  });
}
