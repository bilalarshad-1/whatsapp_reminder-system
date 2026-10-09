import cron from 'node-cron';
import { pollInboundUpdates } from '../services/whatsapp.js';
import { handleIncomingMessage } from '../services/conversation.service.js';

const CRON_EXPRESSION = '*/5 * * * * *';
let running = false;
let pausedUntil = 0;
let consecutiveRateLimits = 0;
let consecutiveErrors = 0;

export function startInboundCron() {
  console.log(`Inbound poller started — ${CRON_EXPRESSION}`);

  cron.schedule(CRON_EXPRESSION, async () => {
    if (running) return;
    if (Date.now() < pausedUntil) return;

    running = true;
    try {
      const messages = await pollInboundUpdates({ timeoutSeconds: 25, limit: 50 });
      consecutiveErrors = 0; // reset on success

      for (const msg of messages) {
        try {
          await handleIncomingMessage(msg);
          consecutiveRateLimits = 0;
        } catch (err) {
          const isRateLimit =
            err.code === 130429 ||
            err.waError?.error?.code === 130429 ||
            String(err.message).includes('130429');
          if (isRateLimit) {
            consecutiveRateLimits += 1;
            const backoffMs = Math.min(30_000 * 2 ** (consecutiveRateLimits - 1), 600_000);
            pausedUntil = Date.now() + backoffMs;
            console.warn(`⏸  rate limit — pausing ${Math.round(backoffMs / 1000)}s`);
            break;
          }
          console.error('❌ handler error for', msg.from, err.message);
        }
      }
    } catch (err) {
      const msg = String(err.message || '');

      // Long-poll timeout is normal — no messages arrived
      if (msg.includes('timeout')) {
        // don't log, don't count
      } else {
        consecutiveErrors += 1;
        // Exponential backoff on repeated errors: 10s, 20s, 40s, ... cap 5 min
        if (consecutiveErrors >= 3) {
          const backoff = Math.min(10_000 * 2 ** (consecutiveErrors - 3), 300_000);
          pausedUntil = Date.now() + backoff;
          console.error(
            `inbound poll error x${consecutiveErrors}: ${msg} — pausing ${Math.round(backoff / 1000)}s`
          );
        } else {
          console.error(`inbound poll error x${consecutiveErrors}: ${msg}`);
        }
      }
    } finally {
      running = false;
    }
  });
}