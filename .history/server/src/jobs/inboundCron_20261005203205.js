import cron from 'node-cron';
import { pollInboundUpdates } from '../services/whatsapp.js';
import { handleIncomingMessage } from '../services/conversation.service.js';

const CRON_EXPRESSION = '*/5 * * * * *'; // every 5 seconds

let running = false;

export function startInboundCron() {
  console.log(`🕐 Inbound poller started — ${CRON_EXPRESSION}`);

  cron.schedule(CRON_EXPRESSION, async () => {
    if (running) return;
    running = true;
    try {
      // Long-poll for up to 25 s. This means the interval should be >= timeout
      // to avoid concurrent requests. 5 s cron + 25 s long-poll is fine because
      // we guard with `running`.
      const messages = await pollInboundUpdates({ timeoutSeconds: 25, limit: 50 });

      for (const msg of messages) {
        try {
          await handleIncomingMessage(msg);
        } catch (err) {
          console.error('❌ handler error for', msg.from, err.message);
          // Optionally notify user
          // await sendWhatsApp(msg.from, 'Sorry, something went wrong. Try again.');
        }
      }
    } catch (err) {
      // Long-poll timeouts are normal (no messages) — don't spam logs
      if (!String(err.message).includes('timeout')) {
        console.error('inbound poll error:', err.message);
      }
    } finally {
      running = false;
    }
  });
}