import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  // Security + body + logging
  app.use(
    helmet({
      contentSecurityPolicy: false, // allow inline <style> on the status page
    })
  );

  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin:
        env.nodeEnv === 'production'
          ? allowedOrigins.length
            ? allowedOrigins
            : false
          : true,
      credentials: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.logLevel === 'dev' ? 'dev' : 'combined'));

  // ─────────────────────────────────────────────────────────────
  // JSON health probe (used by Render / UptimeRobot)
  // ─────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'reminder-server',
      env: env.nodeEnv,
      time: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Human-facing status page at "/"
  // ─────────────────────────────────────────────────────────────
  app.get('/', async (req, res) => {
    const started = Date.now();

    const mongoState = mongoose.connection.readyState;
    const mongoMap = {
      0: { label: 'disconnected', color: '#991b1b' },
      1: { label: 'connected',    color: '#166534' },
      2: { label: 'connecting',   color: '#92400e' },
      3: { label: 'disconnecting',color: '#92400e' },
    };
    const mongo = mongoMap[mongoState] || { label: 'unknown', color: '#374151' };

    // Heartbeat lookup (skip if Mongo isn't connected)
    let hb = null;
    let hbAge = null;
    let hbStale = null;

    if (mongoState === 1) {
      try {
        const { Heartbeat } = await import('./models/index.js');
        hb = await Heartbeat.findOne({ key: 'reminder-cron' }).lean();
        if (hb?.lastRunAt) {
          hbAge = Math.round((Date.now() - new Date(hb.lastRunAt).getTime()) / 1000);
          hbStale = hbAge > 180;
        }
      } catch {
        // ignore — status page must never 500
      }
    }

    const fmtUptime = (s) => {
      s = Math.floor(s);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`]
        .filter(Boolean)
        .join(' ');
    };

    const mask = (v) =>
      !v ? '—' : v.length <= 8 ? '••••' : `${v.slice(0, 4)}…${v.slice(-4)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reminder Server · Status</title>
<style>
  :root {
    --bg: #f6f7fb;
    --card: #fff;
    --border: #e3e5ea;
    --text: #111;
    --muted: #666;
    --accent: #4f46e5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 32px 16px;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 14px; }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 16px;
  }
  .row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #eef0f5;
    font-size: 14px;
  }
  .row:last-child { border-bottom: 0; }
  .label { color: var(--muted); }
  .ok   { color: #166534; font-weight: 600; }
  .warn { color: #92400e; font-weight: 600; }
  .bad  { color: #991b1b; font-weight: 600; }
  code {
    background: #f4f3ec;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .links { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Reminder Server</h1>
    <p class="sub">Backend status · ${new Date().toISOString()}</p>

    <div class="card">
      <div class="row"><span class="label">Service</span><span><span class="dot" style="background:#166534"></span>running</span></div>
      <div class="row"><span class="label">Environment</span><span><code>${env.nodeEnv}</code></span></div>
      <div class="row"><span class="label">Uptime</span><span>${fmtUptime(process.uptime())}</span></div>
      <div class="row"><span class="label">Node</span><span>${process.version}</span></div>
      <div class="row"><span class="label">PID</span><span>${process.pid}</span></div>
      <div class="row"><span class="label">Response time</span><span>${Date.now() - started} ms</span></div>
    </div>

    <div class="card">
      <div class="row"><span class="label">MongoDB</span><span style="color:${mongo.color};font-weight:600">${mongo.label}</span></div>
      <div class="row"><span class="label">Database</span><span>${mongoose.connection.name || '—'}</span></div>
      <div class="row"><span class="label">Host</span><span>${mongoose.connection.host || '—'}</span></div>
    </div>

    <div class="card">
      <div class="row">
        <span class="label">Cron heartbeat</span>
        <span class="${hbStale === null ? '' : hbStale ? 'bad' : 'ok'}">
          ${
            hb?.lastRunAt
              ? `${hbStale ? 'STALE' : 'OK'} — last run ${hbAge}s ago`
              : 'no heartbeat yet'
          }
        </span>
      </div>
      <div class="row"><span class="label">Last batch sent</span><span>${hb?.sent ?? '—'}</span></div>
      <div class="row"><span class="label">Last batch failed</span><span>${hb?.failed ?? '—'}</span></div>
      <div class="row"><span class="label">Last run at</span><span>${hb?.lastRunAt ? new Date(hb.lastRunAt).toISOString() : '—'}</span></div>
    </div>

    <div class="card">
      <div class="row"><span class="label">WhatsApp base</span><span><code>${env.whatsapp.base}</code></span></div>
      <div class="row"><span class="label">WhatsApp key</span><span><code>${mask(env.whatsapp.key)}</code></span></div>
      <div class="row"><span class="label">Default TZ</span><span>${env.timezone}</span></div>
    </div>

    <div class="card">
      <div class="links">
        <a href="/health">/health</a>
        <a href="/api/system/health">/api/system/health</a>
      </div>
    </div>
  </div>
</body>
</html>`;

    res
      .status(mongoState === 1 ? 200 : 503)
      .type('html')
      .send(html);
  });

  // ─────────────────────────────────────────────────────────────
  // API routes
  // ─────────────────────────────────────────────────────────────
  app.use('/api', apiRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: 'Not Found',
      path: req.originalUrl,
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('💥 Error:', err);
    res.status(status).json({
      ok: false,
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}