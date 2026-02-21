import 'dotenv/config';
import { Worker } from 'bullmq';
import { processSale } from './processors/sale.processor';

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null as null,
};

const worker = new Worker(
  'sales',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
    await processSale(job.data);
  },
  {
    connection,
    concurrency: 5,
  },
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('Worker started, listening for jobs...');
