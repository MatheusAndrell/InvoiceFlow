import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middlewares/auth';
import { SalesService } from '../services/sales.service';

const salesService = new SalesService();

export async function createSale(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { amount, description } = req.body;

  try {
    const sale = await salesService.create(req.userId!, { amount: parseFloat(amount), description });
    res.status(202).json(sale);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create sale';
    res.status(500).json({ error: message });
  }
}

export async function getSales(req: AuthRequest, res: Response): Promise<void> {
  try {
    const sales = await salesService.listByUser(req.userId!);
    res.json(sales);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sales';
    res.status(500).json({ error: message });
  }
}

export async function getSale(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const sale = await salesService.getById(id, req.userId!);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    res.json(sale);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get sale';
    res.status(500).json({ error: message });
  }
}
