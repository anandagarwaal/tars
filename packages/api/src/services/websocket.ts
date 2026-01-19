// ============================================
// WebSocket Service for Real-time Updates
// ============================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';

// Message types
export type WSMessageType = 
  | 'connection'
  | 'prd:processing'
  | 'prd:scenario-generated'
  | 'prd:complete'
  | 'prd:error'
  | 'test:started'
  | 'test:progress'
  | 'test:complete'
  | 'cache:hit'
  | 'system:status';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: string;
  id?: string;
}

// Client tracking
interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private messageHistory: WSMessage[] = [];
  private maxHistorySize = 100;

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      
      const client: WSClient = {
        id: clientId,
        ws,
        subscriptions: new Set(['*']), // Subscribe to all by default
        connectedAt: new Date(),
      };

      this.clients.set(clientId, client);
      console.log(`📡 WebSocket client connected: ${clientId} (total: ${this.clients.size})`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        payload: {
          clientId,
          message: 'Connected to TARS WebSocket',
          serverTime: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (e) {
          console.error('Invalid WebSocket message:', e);
        }
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`📡 WebSocket client disconnected: ${clientId} (total: ${this.clients.size})`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    console.log('📡 WebSocket server initialized on /ws');
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        // Subscribe to specific channels
        if (Array.isArray(message.channels)) {
          message.channels.forEach((ch: string) => client.subscriptions.add(ch));
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from channels
        if (Array.isArray(message.channels)) {
          message.channels.forEach((ch: string) => client.subscriptions.delete(ch));
        }
        break;

      case 'ping':
        // Respond to ping
        this.sendToClient(clientId, {
          type: 'system:status',
          payload: { pong: true },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'get-history':
        // Send recent message history
        const history = this.messageHistory.slice(-20);
        this.sendToClient(clientId, {
          type: 'system:status',
          payload: { history },
          timestamp: new Date().toISOString(),
        });
        break;
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WSMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSMessage, channel?: string): void {
    const messageWithId = { ...message, id: uuidv4() };
    
    // Store in history
    this.messageHistory.push(messageWithId);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Send to subscribed clients
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if client is subscribed to this channel or all (*)
        if (!channel || client.subscriptions.has('*') || client.subscriptions.has(channel)) {
          client.ws.send(JSON.stringify(messageWithId));
        }
      }
    });
  }

  /**
   * Emit PRD processing started
   */
  emitPrdProcessing(prdId: string, title: string): void {
    this.broadcast({
      type: 'prd:processing',
      payload: {
        prdId,
        title,
        status: 'processing',
        stage: 'analyzing',
        progress: 0,
      },
      timestamp: new Date().toISOString(),
    }, `prd:${prdId}`);
  }

  /**
   * Emit scenario generated (during PRD processing)
   */
  emitScenarioGenerated(prdId: string, scenario: any, current: number, total: number): void {
    this.broadcast({
      type: 'prd:scenario-generated',
      payload: {
        prdId,
        scenario: {
          id: scenario.id,
          title: scenario.title,
          type: scenario.type,
          priority: scenario.priority,
        },
        progress: Math.round((current / total) * 100),
        current,
        total,
      },
      timestamp: new Date().toISOString(),
    }, `prd:${prdId}`);
  }

  /**
   * Emit PRD processing complete
   */
  emitPrdComplete(prdId: string, scenarioCount: number): void {
    this.broadcast({
      type: 'prd:complete',
      payload: {
        prdId,
        scenarioCount,
        status: 'completed',
        progress: 100,
      },
      timestamp: new Date().toISOString(),
    }, `prd:${prdId}`);
  }

  /**
   * Emit PRD processing error
   */
  emitPrdError(prdId: string, error: string): void {
    this.broadcast({
      type: 'prd:error',
      payload: {
        prdId,
        error,
        status: 'failed',
      },
      timestamp: new Date().toISOString(),
    }, `prd:${prdId}`);
  }

  /**
   * Emit test started
   */
  emitTestStarted(runId: string, testFile: string, framework: string): void {
    this.broadcast({
      type: 'test:started',
      payload: {
        runId,
        testFile,
        framework,
        status: 'running',
      },
      timestamp: new Date().toISOString(),
    }, `test:${runId}`);
  }

  /**
   * Emit test progress
   */
  emitTestProgress(runId: string, progress: number, output?: string): void {
    this.broadcast({
      type: 'test:progress',
      payload: {
        runId,
        progress,
        output: output?.slice(-500), // Last 500 chars
      },
      timestamp: new Date().toISOString(),
    }, `test:${runId}`);
  }

  /**
   * Emit test complete
   */
  emitTestComplete(runId: string, result: any): void {
    this.broadcast({
      type: 'test:complete',
      payload: {
        runId,
        status: result.status,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        summary: result.summary,
      },
      timestamp: new Date().toISOString(),
    }, `test:${runId}`);
  }

  /**
   * Emit cache hit (for monitoring)
   */
  emitCacheHit(type: string, key: string): void {
    this.broadcast({
      type: 'cache:hit',
      payload: { type, key: key.substring(0, 20) + '...' },
      timestamp: new Date().toISOString(),
    }, 'cache');
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get service statistics
   */
  getStats(): { clients: number; messagesSent: number } {
    return {
      clients: this.clients.size,
      messagesSent: this.messageHistory.length,
    };
  }
}

// Singleton instance
export const wsService = new WebSocketService();
