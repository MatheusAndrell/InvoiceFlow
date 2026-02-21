import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (executed before any import) ──────────────
const mocks = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  const mockFindFirst = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn().mockResolvedValue('OK');
  const mockDel = vi.fn().mockResolvedValue(1);
  const mockPublish = vi.fn().mockResolvedValue(1);
  const mockCallPrefeitura = vi.fn();
  const mockTriggerWebhook = vi.fn().mockResolvedValue(undefined);

  return {
    mockFindUnique,
    mockFindFirst,
    mockUpdate,
    mockSet,
    mockDel,
    mockPublish,
    mockCallPrefeitura,
    mockTriggerWebhook,
  };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    sale: { findUnique: mocks.mockFindUnique, update: mocks.mockUpdate },
    certificate: { findFirst: mocks.mockFindFirst },
  })),
}));

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      set: mocks.mockSet,
      del: mocks.mockDel,
      publish: mocks.mockPublish,
    })),
  };
});

vi.mock('../src/xml/invoice.xml', () => ({
  generateXml: vi.fn().mockReturnValue('<xml>mock</xml>'),
}));

vi.mock('../src/crypto/sign', () => ({
  signXml: vi.fn().mockResolvedValue('<xml>signed</xml>'),
}));

vi.mock('../src/services/prefeitura.service', () => ({
  callPrefeitura: mocks.mockCallPrefeitura,
}));

vi.mock('../src/services/webhook.service', () => ({
  triggerWebhook: mocks.mockTriggerWebhook,
}));

import { processSale } from '../src/processors/sale.processor';

describe('processSale', () => {
  const saleData = { saleId: 'sale-1', userId: 'user-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSet.mockResolvedValue('OK');
    mocks.mockDel.mockResolvedValue(1);
    mocks.mockPublish.mockResolvedValue(1);
  });

  it('should skip if sale does not exist', async () => {
    mocks.mockFindUnique.mockResolvedValue(null);
    mocks.mockUpdate.mockResolvedValue({ id: 'sale-1', status: 'ERROR' });

    // "Sale not found" is a definitive error — caught and NOT re-thrown
    await processSale(saleData);

    expect(mocks.mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ERROR', errorMsg: 'Sale sale-1 not found' }),
      }),
    );
  });

  it('should skip if already processed (idempotency)', async () => {
    mocks.mockFindUnique.mockResolvedValue({ id: 'sale-1', status: 'SUCCESS' });

    await processSale(saleData);

    expect(mocks.mockUpdate).not.toHaveBeenCalled();
    expect(mocks.mockCallPrefeitura).not.toHaveBeenCalled();
  });

  it('should skip if lock is not acquired (concurrent protection)', async () => {
    mocks.mockSet.mockResolvedValue(null); // lock not acquired

    await processSale(saleData);

    expect(mocks.mockFindUnique).not.toHaveBeenCalled();
  });

  it('should process successfully and update status to SUCCESS', async () => {
    const sale = {
      id: 'sale-1',
      userId: 'user-1',
      amount: 100,
      description: 'Test',
      status: 'PROCESSING',
      createdAt: new Date(),
    };
    mocks.mockFindUnique.mockResolvedValue(sale);
    mocks.mockFindFirst.mockResolvedValue(null); // no certificate
    mocks.mockCallPrefeitura.mockResolvedValue({ success: true, protocol: 'NFSE-OK' });
    mocks.mockUpdate.mockResolvedValue({ ...sale, status: 'SUCCESS', protocol: 'NFSE-OK' });

    await processSale(saleData);

    expect(mocks.mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { status: 'SUCCESS', protocol: 'NFSE-OK' },
    });
    expect(mocks.mockPublish).toHaveBeenCalled();
    expect(mocks.mockTriggerWebhook).toHaveBeenCalledWith({
      saleId: 'sale-1',
      protocol: 'NFSE-OK',
      status: 'SUCCESS',
    });
  });

  it('should set ERROR status when prefeitura rejects', async () => {
    const sale = {
      id: 'sale-1',
      userId: 'user-1',
      amount: 50,
      description: 'Test',
      status: 'PROCESSING',
      createdAt: new Date(),
    };
    mocks.mockFindUnique.mockResolvedValue(sale);
    mocks.mockFindFirst.mockResolvedValue(null);
    mocks.mockCallPrefeitura.mockResolvedValue({
      success: false,
      error: 'CPF inválido',
    });
    mocks.mockUpdate.mockResolvedValue({ ...sale, status: 'ERROR', errorMsg: 'CPF inválido' });

    await processSale(saleData);

    expect(mocks.mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { status: 'ERROR', errorMsg: 'CPF inválido' },
    });
    expect(mocks.mockTriggerWebhook).not.toHaveBeenCalled();
  });

  it('should re-throw transient errors for BullMQ retry', async () => {
    const sale = {
      id: 'sale-1',
      userId: 'user-1',
      amount: 50,
      description: 'Test',
      status: 'PROCESSING',
      createdAt: new Date(),
    };
    mocks.mockFindUnique.mockResolvedValue(sale);
    mocks.mockFindFirst.mockResolvedValue(null);
    mocks.mockCallPrefeitura.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(processSale(saleData)).rejects.toThrow('ECONNREFUSED');

    // Should NOT set status to ERROR for transient errors
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it('should release lock even on error', async () => {
    const sale = {
      id: 'sale-1',
      userId: 'user-1',
      amount: 50,
      description: 'Test',
      status: 'PROCESSING',
      createdAt: new Date(),
    };
    mocks.mockFindUnique.mockResolvedValue(sale);
    mocks.mockFindFirst.mockResolvedValue(null);
    mocks.mockCallPrefeitura.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(processSale(saleData)).rejects.toThrow();

    expect(mocks.mockDel).toHaveBeenCalledWith('lock:sale:sale-1');
  });
});
