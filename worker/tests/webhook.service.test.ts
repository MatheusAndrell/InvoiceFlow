import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const mockAxios: any = {
    post: vi.fn(),
  };
  return { default: mockAxios };
});

import { triggerWebhook } from '../src/services/webhook.service';

describe('triggerWebhook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('should skip if WEBHOOK_URL is not configured', async () => {
    delete process.env.WEBHOOK_URL;

    await triggerWebhook({ saleId: 's1', protocol: 'p1', status: 'SUCCESS' });

    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should call webhook URL with payload', async () => {
    process.env.WEBHOOK_URL = 'https://example.com/hook';
    (axios.post as any).mockResolvedValue({ status: 200 });

    await triggerWebhook({ saleId: 's1', protocol: 'p1', status: 'SUCCESS' });

    expect(axios.post).toHaveBeenCalledWith(
      'https://example.com/hook',
      { saleId: 's1', protocol: 'p1', status: 'SUCCESS' },
      { timeout: 5000 },
    );
  });

  it('should not throw when webhook fails', async () => {
    process.env.WEBHOOK_URL = 'https://example.com/hook';
    (axios.post as any).mockRejectedValue(new Error('Network error'));

    // Should not throw
    await expect(
      triggerWebhook({ saleId: 's1', protocol: 'p1', status: 'SUCCESS' }),
    ).resolves.toBeUndefined();
  });
});
