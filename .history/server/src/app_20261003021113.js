import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';   // ← NEW

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.logLevel));

  // Health
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'reminder-server',
      env: env.nodeEnv,
      time: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Root
  app.get('/', (req, res) => {
    res.json({ name: 'WhatsApp Task Reminder API', version: '0.1.0' });
  });

  // API routes
  app.use('/api', apiRoutes);                // ← NEW

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  });
  
  
// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('💥 Error:', err);
  }
  res.status(status).json({
    ok: false,
    error: err.message || 'Internal Server Error',
  });
});

  return app;
}