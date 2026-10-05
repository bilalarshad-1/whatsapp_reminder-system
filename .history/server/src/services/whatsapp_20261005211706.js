import axios from 'axios';
import dns from 'node:dns';
import { env } from '../config/env.js';
import { AgentOffset } from '../models/index.js';

// Force public DNS at the top of the module — Node on Windows sometimes
// hands out a resolver that refuses SRV or A lookups on api.whatsapp.com.
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');

// ─────────────────────────────────────────────────────────────
// HTTP client
// ─────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: env.whatsapp.base,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${env.whatsapp.key}`,
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────
// Outbound — send a text message through the Agent API
// ─────────────────────────────────────────────────────────────

/**
 * Send a plain text WhatsApp message through the Agent API.
 *
 * @param {string} to    recipient id, e.g. "user:233710897094724"
 * @param {string} body  message text
 * @returns {Promise<object>} WhatsApp API response
 */
export async function sendWhatsApp(to, body) {
  if (!to || typeof to !== 'string') {
    throw new Error('sendWhatsApp: "to" is required');
  }
  if (!to.startsWith('user:')) {
    throw new Error(`sendWhatsApp: "to" must start with "user:" (got "${to}")`);
  }
  if (!body || typeof body !== 'string') {
    throw new Error('sendWhatsApp: "body" is required');
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  };

  try {
    const { data } = await client.post('/messages', payload);
    return data;
  } catch (err) {
    const status = err.response?.status;
    const waError = err.response?.data;
    const normalized = new Error(
      waError?.error?.message || err.message || 'WhatsApp send failed'
    );
    normalized.status = status;
    normalized.code = waError?.error?.code;
    normalized.waError = waError;
    throw normalized;
  }
}

// ─────────────────────────────────────────────────────────────
// Inbound — long-poll /updates and normalize the response
// ─────────────────────────────────────────────────────────────

/**
 * Internal: read the persisted offset (or create it).
 * Sanitizes to a non-negative integer, since WhatsApp rejects bad values.
 */
async function getOffset() {
  let doc = await AgentOffset.findOne({ key: 'whatsapp-agent' });
  if (!doc) {
    doc = await AgentOffset.create({ key: 'whatsapp-agent', offset: 0 });
  }
  let n = Number(doc.offset);
  if (!Number.isFinite(n) || n < 0) n = 0;
  return { doc, offset: Math.floor(n) };
}

/**
 * Fetch new inbound messages from the WhatsApp Agent /updates endpoint.
 * Advances and persists the offset so we don't reprocess messages.
 *
 * @param {{ timeoutSeconds?: number, limit?: number, debug?: boolean }} opts
 * @returns {Promise<Array<{ from: string, text: string, timestamp: string, raw: object }>>}
 */
export async function pollInboundUpdates({
  timeoutSeconds = 25,
  limit = 50,
  debug = false,
} = {}) {
  // Clamp params to sane ranges
  const timeout = Math.max(0, Math.min(Number(timeoutSeconds) || 0, 60));
  const lim = Math.max(1, Math.min(Number(limit) || 50, 100));

  const { doc, offset } = await getOffset();

  const params = { offset, limit: lim, timeout };

  if (debug) {
    console.log('→ GET /updates', params);
  }

  let data;
  try {
    ({ data } = await client.get('/updates', { params }));
  } catch (err) {
    const status = err.response?.status;
    const waError = err.response?.data;
    const msg = waError?.error?.message || err.message || 'updates failed';

    const e = new Error(`pollInboundUpdates: ${msg}`);
    e.status = status;
    e.code = waError?.error?.code;
    e.waError = waError;
    throw e;
  }

  if (debug) {
    console.log('← /updates', {
      next_offset: data?.next_offset,
      entries: data?.entry?.length ?? 0,
    });
  }

  // Persist the next offset, if the API gave us one
  if (typeof data?.next_offset === 'number' && data.next_offset >= offset) {
    doc.offset = data.next_offset;
    await doc.save();
  }

  // Normalize deeply nested response into a flat message list
  const messages = [];
  for (const entry of data?.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        const text = msg.text?.body;
        if (typeof text === 'string' && msg.from) {
          messages.push({
            from: msg.from,
            text: text.trim(),
            timestamp: msg.timestamp,
            raw: msg,
          });
        }
      }
    }
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────
// Diagnostics (optional, safe to leave in)
// ─────────────────────────────────────────────────────────────

/**
 * Ping the API without advancing the offset.
 * Useful to check connectivity / auth without side effects.
 */
export async function pingUpdates({ timeoutSeconds = 0, limit = 1 } = {}) {
  const { offset } = await getOffset();
  const params = { offset, limit, timeout: timeoutSeconds };
  try {
    const { data } = await client.get('/updates', { params });
    return { ok: true, next_offset: data?.next_offset ?? null, offset };
  } catch (err) {
    return {
      ok: false,
      offset,
      status: err.response?.status ?? null,
      error: err.response?.data?.error?.message || err.message,
      code: err.response?.data?.error?.code ?? null,
    };
  }
}

export function currentOffsetDoc() {
  return AgentOffset.findOne({ key: 'whatsapp-agent' }).lean();
}