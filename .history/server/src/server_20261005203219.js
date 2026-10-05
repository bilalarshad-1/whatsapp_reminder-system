import './models/index.js';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startReminderCron } from './jobs/reminderCron.js';
import { startInboundCron } from './jobs/inboundCron.js';

async function start() {
  await connectDB();
  startReminderCron();
  startInboundCron();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`🚀 API listening on http://localhost:${env.port}  [${env.nodeEnv}]`);
    console.log(`   Status : http://localhost:${env.port}/`);
    console.log(`   Health : http://localhost:${env.port}/health`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(() => console.log('HTTP server closed'));
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (r) => console.error('Unhandled Rejection:', r));
  process.on('uncaughtException', (e) => {
    console.error('Uncaught Exception:', e);
    process.exit(1);
  });
}

start();