import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import certificateRoutes from './routes/certificate.routes';
import salesRoutes from './routes/sales.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/certificates', certificateRoutes);
app.use('/sales', salesRoutes);

app.use(errorHandler);

export default app;
