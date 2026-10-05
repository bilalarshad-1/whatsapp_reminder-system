import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { testSend } from '../controllers/whatsapp.controller.js';

const router = Router();

router.post('/test-send', requireAuth, testSend);

export default router;