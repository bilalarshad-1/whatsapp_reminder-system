import { sendWhatsApp } from '../services/whatsapp.js';

export async function testSend(req, res) {
  try {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({
        ok: false,
        error: 'Both "to" and "body" are required in the JSON body.',
      });
    }

    const result = await sendWhatsApp(to, body);

    res.json({ ok: true, result });
  } catch (err) {
    console.error('❌ testSend failed:', {
      message: err.message,
      status: err.status,
      code: err.code,
      waError: err.waError,
    });

    res.status(err.status || 500).json({
      ok: false,
      error: err.message,
      code: err.code,
      waError: err.waError,
    });
  }
}