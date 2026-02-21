import axios from 'axios';

interface WebhookPayload {
  saleId: string;
  protocol: string;
  status: string;
}

export async function triggerWebhook(payload: WebhookPayload): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('WEBHOOK_URL not configured, skipping webhook');
    return;
  }

  try {
    await axios.post(webhookUrl, payload, { timeout: 5000 });
    console.log(`Webhook triggered successfully for sale ${payload.saleId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook failed';
    console.error(`Webhook failed for sale ${payload.saleId}: ${message}`);
    // Don't throw - webhook failure should not fail the job
  }
}
