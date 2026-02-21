import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import certificateRoutes from './routes/certificate.routes';
import salesRoutes from './routes/sales.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/certificates', certificateRoutes);
app.use('/sales', salesRoutes);

app.use(errorHandler);

export default app;
