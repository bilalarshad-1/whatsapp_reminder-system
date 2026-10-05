import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');
import axios from 'axios';
import { env } from '../config/env.js';
import { AgentOffset } from '../models/index.js';

/**
 * Fetch new inbound messages from the WhatsApp Agent /updates endpoint.
 * Advances and persists the offset so we don't reprocess.
 *
 * @returns {Promise<Array<{ from: string, text: string, timestamp: string }>>}
 */
export async function pollInboundUpdates({ timeoutSeconds = 25, limit = 50 } = {}) {
  // Load current offset (create if missing)
  let offsetDoc = await AgentOffset.findOne({ key: 'whatsapp-agent' });
  if (!offsetDoc) {
    offsetDoc = await AgentOffset.create({ key: 'whatsapp-agent', offset: 0 });
  }

  const url = `${env.whatsapp.base}/updates`;
  const params = {
    offset: offsetDoc.offset,
    limit,
    timeout: timeoutSeconds,
  };

  const { data } = await client.get(url, { params });

  // Persist next offset if provided
  if (typeof data?.next_offset === 'number') {
    offsetDoc.offset = data.next_offset;
    await offsetDoc.save();
  }

  // Normalize the nested response into flat messages
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
          });
        }
      }
    }
  }
  return messages;
}

const client = axios.create({
  baseURL: env.whatsapp.base,
  timeout: 10000, 
  headers: {
    Authorization: `Bearer ${env.whatsapp.key}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Send a plain text WhatsApp message through the Agent API.
 *
 * @param {string} to   recipient id, e.g. "user:233710897094724"
 * @param {string} body message text
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
    // Normalize axios errors so callers get a consistent shape
    const status = err.response?.status;
    const waError = err.response?.data;
    const normalized = new Error(
      waError?.error?.message ||
        err.message ||
        'WhatsApp send failed'
    );
    normalized.status = status;
    normalized.waError = waError;
    normalized.code = waError?.error?.code;
    throw normalized;
  }
}