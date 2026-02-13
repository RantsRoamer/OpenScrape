/**
 * WebSocket server for real-time job updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { CrawlJob, JobEventType, JobEventMessage, WsClientMessage } from './types';

/** Map of jobId -> Set of client WebSockets subscribed to that job */
const jobSubscriptions = new Map<string, Set<WebSocket>>();

/** All connected clients (for broadcast or subscribe-all) */
const allClients = new Set<WebSocket>();

let wss: WebSocketServer | null = null;

/**
 * Create and attach WebSocket server to the HTTP server
 */
export function attachWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    allClients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as WsClientMessage;
        if (msg.type === 'subscribe' && msg.jobId) {
          if (!jobSubscriptions.has(msg.jobId)) {
            jobSubscriptions.set(msg.jobId, new Set());
          }
          jobSubscriptions.get(msg.jobId)!.add(ws);
        } else if (msg.type === 'unsubscribe' && msg.jobId) {
          jobSubscriptions.get(msg.jobId)?.delete(ws);
        }
      } catch {
        // Ignore invalid JSON
      }
    });

    ws.on('close', () => {
      allClients.delete(ws);
      jobSubscriptions.forEach((clients) => clients.delete(ws));
    });
  });

  return wss;
}

/**
 * Broadcast a job event to all clients subscribed to that job
 */
export function broadcastJobEvent(
  event: JobEventType,
  jobId: string,
  job: Partial<CrawlJob>
): void {
  const message: JobEventMessage = {
    event,
    jobId,
    job: {
      id: job.id,
      url: job.url,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    },
    timestamp: new Date().toISOString(),
  };
  const payload = JSON.stringify(message);

  const subscribers = jobSubscriptions.get(jobId);
  if (subscribers) {
    subscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Also send to any client that subscribed to "all" (optional: could add type: 'subscribe', jobId: '*' )
  // For now we only send to job-specific subscribers.
}

/**
 * Close the WebSocket server
 */
export function closeWebSocketServer(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
  jobSubscriptions.clear();
  allClients.clear();
}
