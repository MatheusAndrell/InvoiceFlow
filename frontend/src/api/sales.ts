import api from './client';

export interface Sale {
  id: string;
  amount: number;
  description: string;
  status: 'PROCESSING' | 'SUCCESS' | 'ERROR';
  protocol: string | null;
  errorMsg: string | null;
  createdAt: string;
}

export async function getSales(): Promise<Sale[]> {
  const res = await api.get('/sales');
  return res.data as Sale[];
}

export async function createSale(data: { amount: number; description: string }): Promise<Sale> {
  const res = await api.post('/sales', data);
  return res.data as Sale;
}
