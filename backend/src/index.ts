import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger';
import { connectDB } from './utils/db';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import policyRoutes from './routes/policies';
import changeRequestRoutes from './routes/changeRequests';
import versionRoutes from './routes/versions';
import auditRoutes from './routes/audit';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import demoRoutes from './demo/demoRoutes';

import { startPollingJob } from './jobs/policyPoller';
import { startLockExpiryJob } from './jobs/lockExpiry';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'] } }, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS)||900000, max: Number(process.env.RATE_LIMIT_MAX)||100, standardHeaders: true, legacyHeaders: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0', mode: DEMO_MODE ? 'demo' : 'production' }));

if (DEMO_MODE) {
  logger.info('DEMO MODE ENABLED - no Azure subscription or database required');
  app.use('/api', demoRoutes);
} else {
  app.use('/api/auth', authRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/policies', policyRoutes);
  app.use('/api/change-requests', changeRequestRoutes);
  app.use('/api/versions', versionRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);
}

app.use(errorHandler);

async function bootstrap() {
  try {
    if (!DEMO_MODE) {
      await connectDB();
      logger.info('Database connected');
      startPollingJob();
      startLockExpiryJob();
    }
    app.listen(PORT, () => logger.info(`CA Guardian API on port ${PORT} [${DEMO_MODE ? 'DEMO' : 'PRODUCTION'}]`));
  } catch (err) {
    logger.error('Failed to start', err);
    process.exit(1);
  }
}

bootstrap();
export default app;
