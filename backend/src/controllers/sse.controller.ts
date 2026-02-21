import { Response } from 'express';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middlewares/auth';

/**
 * SSE endpoint for real-time sale status updates.
 * Accepts auth token via query param (EventSource doesn't support headers).
 * Subscribes to Redis pub/sub channel `sale:updates:{userId}`.
 */
export async function sseEvents(req: AuthRequest, res: Response): Promise<void> {
  // Accept token from query param for EventSource compatibility
  const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  let userId: string;
  try {
    const secret = process.env.JWT_SECRET as string;
    const payload = jwt.verify(token, secret) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });
  res.flushHeaders();

  // Send initial keep-alive
  res.write(': connected\n\n');

  // Create dedicated Redis subscriber for this connection
  const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });

  const channel = `sale:updates:${userId}`;

  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error('Failed to subscribe to Redis channel:', err);
      res.end();
      return;
    }
    console.log(`SSE client subscribed to ${channel}`);
  });

  subscriber.on('message', (_ch: string, message: string) => {
    res.write(`event: sale-update\ndata: ${message}\n\n`);
  });

  // Keep-alive ping every 15 seconds
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 15_000);

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`SSE client disconnected from ${channel}`);
    clearInterval(keepAlive);
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.quit().catch(() => {});
  });
}
