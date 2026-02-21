import { describe, it, expect } from 'vitest';
import { generateXml } from '../src/xml/invoice.xml';

describe('generateXml', () => {
  it('should generate valid NFS-e XML with sale data', () => {
    const sale = {
      id: 'sale-123',
      amount: 150.5,
      description: 'Consultoria de TI',
      createdAt: new Date('2026-01-15T10:30:00Z'),
    };

    const xml = generateXml(sale);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<NFSe>');
    expect(xml).toContain('<Numero>sale-123</Numero>');
    expect(xml).toContain('<ValorServicos>150.50</ValorServicos>');
    expect(xml).toContain('<Discriminacao>Consultoria de TI</Discriminacao>');
    expect(xml).toContain('2026-01-15T10:30:00.000Z');
  });

  it('should escape XML special characters in description', () => {
    const sale = {
      id: 'sale-456',
      amount: 100,
      description: 'Serviço <TI> & "Suporte"',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    };

    const xml = generateXml(sale);

    expect(xml).not.toContain('<TI>');
    expect(xml).toContain('&lt;TI&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;Suporte&quot;');
  });

  it('should format amount with two decimal places', () => {
    const sale = {
      id: 'sale-789',
      amount: 1000,
      description: 'Teste',
      createdAt: new Date(),
    };

    const xml = generateXml(sale);

    expect(xml).toContain('<ValorServicos>1000.00</ValorServicos>');
  });
});
