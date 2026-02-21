import { Router } from 'express';
import { body } from 'express-validator';
import { createSale, getSales, getSale } from '../controllers/sales.controller';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('description').notEmpty().withMessage('Description required'),
  ],
  createSale,
);

router.get('/', getSales);
router.get('/:id', getSale);

export default router;
