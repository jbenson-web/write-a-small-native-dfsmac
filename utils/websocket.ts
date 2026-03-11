
import { BACKEND_URL, getBearerToken } from './api';

export type GamificationMessage =
  | { type: 'stats-update'; data: { currentStreak: number; totalPoints: number; perfectDays: number } }
  | { type: 'achievement-unlocked'; data: { achievementType: string; achievementName: string; metadata?: any } }
  | { type: 'leaderboard-update'; data: { userId: string; userName: string; totalPoints: number; currentStreak: number }[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'connected'; data: { userId: string } }
  | { type: 'error'; data: { message: string } };

export type MessageHandler = (message: GamificationMessage) => void;

export class GamificationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private isIntentionallyClosed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    console.log('[WebSocket] GamificationWebSocket instance created');
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      const token = await getBearerToken();
      if (!token) {
        console.error('[WebSocket] No bearer token found');
        throw new Error('Authentication required');
      }

      const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const url = `${wsUrl}/ws/gamification?token=${encodeURIComponent(token)}`;
      
      console.log('[WebSocket] Connecting to:', wsUrl + '/ws/gamification');

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.reconnectAttempts = 0;
        
        // Subscribe to all channels
        this.send({ type: 'subscribe', channels: ['stats', 'achievements', 'leaderboard'] });

        // Start ping interval
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as GamificationMessage;
          console.log('[WebSocket] Received message:', message.type);

          // Auto-respond to pings
          if (message.type === 'ping') {
            this.send({ type: 'pong' });
            return;
          }

          // Notify all handlers
          this.messageHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('[WebSocket] Handler error:', error);
            }
          });
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        this.cleanup();

        // Attempt reconnection if not intentionally closed
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      throw error;
    }
  }

  disconnect(): void {
    console.log('[WebSocket] Disconnecting intentionally');
    this.isIntentionallyClosed = true;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startPingInterval(): void {
    // Send ping every 25 seconds (server expects response within 30s)
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 25000);
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send, connection not open');
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let gamificationWS: GamificationWebSocket | null = null;

export const getGamificationWebSocket = (): GamificationWebSocket => {
  if (!gamificationWS) {
    gamificationWS = new GamificationWebSocket();
  }
  return gamificationWS;
};
