import { PrismaClient } from '@prisma/client';
import { generateXml } from '../xml/invoice.xml';
import { signXml } from '../crypto/sign';
import { callPrefeitura } from '../services/prefeitura.service';
import { triggerWebhook } from '../services/webhook.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function processSale(data: { saleId: string; userId: string }): Promise<void> {
  const { saleId, userId } = data;

  // Idempotency check: skip if already processed
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale) {
    throw new Error(`Sale ${saleId} not found`);
  }

  if (sale.status !== 'PROCESSING') {
    console.log(`Sale ${saleId} already processed with status ${sale.status}, skipping.`);
    return;
  }

  try {
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
      await prisma.sale.update({
        where: { id: saleId },
        data: { status: 'SUCCESS', protocol },
      });

      // Trigger webhook on success
      await triggerWebhook({ saleId, protocol, status: 'SUCCESS' });
    } else {
      await prisma.sale.update({
        where: { id: saleId },
        data: { status: 'ERROR', errorMsg: result.error || 'Prefeitura rejected the invoice' },
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    await prisma.sale.update({
      where: { id: saleId },
      data: { status: 'ERROR', errorMsg },
    });
    throw err; // Re-throw for BullMQ retry
  }
}
