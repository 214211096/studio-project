import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import scheduleRoutes from './routes/schedule.js';
import meRoutes from './routes/me.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', scheduleRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'נתיב לא קיים' }));

  // בייצור: השרת מגיש גם את צד הלקוח הבנוי (client/dist)
  const clientDist = path.resolve('../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
