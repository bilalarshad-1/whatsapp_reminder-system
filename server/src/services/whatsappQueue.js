import { sendWhatsApp } from './whatsapp.js';

const MIN_GAP_MS = 1200;        // ~1 msg/sec — safe for most agent limits
let lastSendAt = 0;
let chain = Promise.resolve();
let queuedCount = 0;

/**
 * Enqueue a WhatsApp send. Guarantees at least MIN_GAP_MS between sends.
 * Returns the WhatsApp API response.
 */
export function enqueueWhatsApp(to, body) {
  queuedCount += 1;
  chain = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastSendAt + MIN_GAP_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSendAt = Date.now();
    try {
      return await sendWhatsApp(to, body);
    } finally {
      queuedCount -= 1;
    }
  });
  return chain;
}

export function queueSize() {
  return queuedCount;
}