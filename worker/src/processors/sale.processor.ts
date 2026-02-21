import { PrismaClient } from '@prisma/client';
import { generateXml } from '../xml/invoice.xml';
import { signXml } from '../crypto/sign';
import { callPrefeitura } from '../services/prefeitura.service';
import { triggerWebhook } from '../services/webhook.service';
import crypto from 'crypto';
import Redis from 'ioredis';

const prisma = new PrismaClient();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const LOCK_TTL = 60; // seconds

/**
 * Acquire a distributed lock via Redis SET NX EX.
 * Returns true if acquired, false if another instance holds it.
 */
async function acquireLock(saleId: string): Promise<boolean> {
  const result = await redis.set(`lock:sale:${saleId}`, '1', 'EX', LOCK_TTL, 'NX');
  return result === 'OK';
}

async function releaseLock(saleId: string): Promise<void> {
  await redis.del(`lock:sale:${saleId}`).catch(() => {});
}

/**
 * Determines whether an error is transient (network, timeout) and worth retrying,
 * versus a definitive business rejection from the prefeitura.
 */
function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('socket') ||
      msg.includes('network')
    );
  }
  return false;
}

export async function processSale(data: { saleId: string; userId: string }): Promise<void> {
  const { saleId, userId } = data;

  // Distributed lock — prevents concurrent processing of the same sale
  const locked = await acquireLock(saleId);
  if (!locked) {
    console.log(`Sale ${saleId} is being processed by another worker, skipping.`);
    return;
  }

  try {
    // Idempotency check: skip if already processed
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) {
      throw new Error(`Sale ${saleId} not found`);
    }

    if (sale.status !== 'PROCESSING') {
      console.log(`Sale ${saleId} already processed with status ${sale.status}, skipping.`);
      return;
    }

    // Generate XML invoice
    const xml = generateXml(sale);

    // Get user certificate
    const certificate = await prisma.certificate.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Sign XML (use mock signing if no certificate)
    const signedXml = certificate
      ? await signXml(xml, certificate)
      : xml + '<!-- mock-signed -->';

    // Call prefeitura mock service
    const result = await callPrefeitura(signedXml, saleId);

    if (result.success) {
      const protocol = result.protocol || crypto.randomUUID();
      const updated = await prisma.sale.update({
        where: { id: saleId },
        data: { status: 'SUCCESS', protocol },
      });

      await redis.publish(`sale:updates:${userId}`, JSON.stringify(updated));
      await triggerWebhook({ saleId, protocol, status: 'SUCCESS' });
    } else {
      const updated = await prisma.sale.update({
        where: { id: saleId },
        data: { status: 'ERROR', errorMsg: result.error || 'Prefeitura rejected the invoice' },
      });

      await redis.publish(`sale:updates:${userId}`, JSON.stringify(updated));
    }
  } catch (err) {
    // Only set ERROR status for non-transient failures.
    // Transient errors re-throw so BullMQ retries with the sale still PROCESSING.
    if (isTransientError(err)) {
      console.warn(`Transient error for sale ${saleId}, will retry:`, (err as Error).message);
      throw err;
    }

    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const updated = await prisma.sale.update({
      where: { id: saleId },
      data: { status: 'ERROR', errorMsg },
    });

    await redis.publish(`sale:updates:${userId}`, JSON.stringify(updated)).catch(() => {});
    // Don't re-throw definitive errors — no point retrying
  } finally {
    await releaseLock(saleId);
  }
}
