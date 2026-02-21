import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios: any = {
    post: vi.fn(),
    isAxiosError: vi.fn((err: any) => err?.isAxiosError === true),
  };
  return { default: mockAxios };
});

// Must import AFTER mock
import { callPrefeitura } from '../src/services/prefeitura.service';

describe('callPrefeitura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success with protocol on 200 response', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: { success: true, protocol: 'NFSE-ABC123' },
    });

    const result = await callPrefeitura('<xml/>', 'sale-1');

    expect(result.success).toBe(true);
    expect(result.protocol).toBe('NFSE-ABC123');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('should return error on prefeitura business rejection (422)', async () => {
    const axiosError = {
      isAxiosError: true,
      response: { data: { success: false, error: 'CPF inválido' } },
    };
    (axios.post as any).mockRejectedValueOnce(axiosError);
    (axios.isAxiosError as any).mockReturnValueOnce(true);

    const result = await callPrefeitura('<xml/>', 'sale-2');

    expect(result.success).toBe(false);
    expect(result.error).toBe('CPF inválido');
    // Should NOT retry on business rejection
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors up to MAX_RETRIES', async () => {
    const networkError = new Error('ECONNREFUSED');
    (axios.post as any)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    const result = await callPrefeitura('<xml/>', 'sale-3');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
    expect(axios.post).toHaveBeenCalledTimes(3);
  }, 30000);

  it('should succeed on retry after transient failure', async () => {
    const networkError = new Error('timeout');
    (axios.post as any)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        data: { success: true, protocol: 'NFSE-RETRY1' },
      });

    const result = await callPrefeitura('<xml/>', 'sale-4');

    expect(result.success).toBe(true);
    expect(result.protocol).toBe('NFSE-RETRY1');
    expect(axios.post).toHaveBeenCalledTimes(2);
  }, 30000);
});
