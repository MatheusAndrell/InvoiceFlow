import { Router } from 'express';
import { body } from 'express-validator';
import { login } from '../controllers/auth.controller';

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  login,
);

export default router;
