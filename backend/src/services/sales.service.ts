import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const salesQueue = new Queue('sales', { connection });

export class SalesService {
  async create(userId: string, data: { amount: number; description: string }) {
    const jobId = uuidv4();

    const sale = await prisma.sale.create({
      data: {
        userId,
        amount: data.amount,
        description: data.description,
        status: 'PROCESSING',
        jobId,
      },
    });

    await salesQueue.add(
      'process-sale',
      { saleId: sale.id, userId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return sale;
  }

  async listByUser(userId: string) {
    return prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    return prisma.sale.findFirst({
      where: { id, userId },
    });
  }
}
