import cron from 'node-cron';
import { pollInboundUpdates } from '../services/whatsapp.js';
import { handleIncomingMessage } from '../services/conversation.service.js';

const CRON_EXPRESSION = '*/5 * * * * *';
let running = false;

// Rate-limit state
let pausedUntil = 0;             // epoch ms; don't call WhatsApp before this
let consecutiveRateLimits = 0;

export function startInboundCron() {
  console.log(`🕐 Inbound poller started — ${CRON_EXPRESSION}`);

  cron.schedule(CRON_EXPRESSION, async () => {
    if (running) return;

    if (Date.now() < pausedUntil) {
      // silently skip — we're backing off
      return;
    }

    running = true;
    try {
      const messages = await pollInboundUpdates({ timeoutSeconds: 25, limit: 50 });

      for (const msg of messages) {
        try {
          await handleIncomingMessage(msg);
          consecutiveRateLimits = 0;
        } catch (err) {
          const isRateLimit =
            err.code === 130429 ||
            err.waError?.error?.code === 130429 ||
            String(err.message).includes('130429') ||
            String(err.message).includes('exceeded the maximum number of requests');

          if (isRateLimit) {
            consecutiveRateLimits += 1;
            // Exponential backoff: 30s, 60s, 120s, 240s, max 10 min
            const backoffMs = Math.min(30_000 * 2 ** (consecutiveRateLimits - 1), 600_000);
            pausedUntil = Date.now() + backoffMs;
            console.warn(
              `⏸  WhatsApp rate limit hit — pausing ${Math.round(backoffMs / 1000)}s ` +
              `(streak ${consecutiveRateLimits})`
            );
            break; // stop processing this batch, wait for backoff
          } else {
            console.error('❌ handler error for', msg.from, err.message);
          }
        }
      }
    } catch (err) {
      if (!String(err.message).includes('timeout')) {
        console.error('inbound poll error:', err.message);
      }
    } finally {
      running = false;
    }
  });
}