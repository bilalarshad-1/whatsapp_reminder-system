import './models/index.js';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startReminderCron } from './jobs/reminderCron.js';   

async function start() {
  await connectDB();
  startReminderCron();                                        

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`🚀 API listening on http://localhost:${env.port}  [${env.nodeEnv}]`);
    console.log(`   Health: http://localhost:${env.port}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(() => console.log('HTTP server closed'));
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
// app.use(cors({ origin: ['http://localhost:5173'] }));
  // Crash safety
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

start();