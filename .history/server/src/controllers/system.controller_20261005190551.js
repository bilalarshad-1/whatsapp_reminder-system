import { Heartbeat } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthDetailed = asyncHandler(async (req, res) => {
  const hb = await Heartbeat.findOne({ key: 'reminder-cron' }).lean();
  const now = Date.now();
  const stale = !hb || now - new Date(hb.lastRunAt).getTime() > 3 * 60_000;

  res.json({
    ok: !stale,
    cron: hb
      ? {
          lastRunAt: hb.lastRunAt,
          sent: hb.sent,
          failed: hb.failed,
          ageSeconds: Math.round((now - new Date(hb.lastRunAt).getTime()) / 1000),
        }
      : null,
    staleCron: stale,
  });
});