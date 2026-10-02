import { Router } from 'express';
import { testSend } from '../controllers/whatsapp.controller.js';

const router = Router();

// POST /api/test-send  → for Phase 2 verification only
router.post('/test-send', testSend);

export default router;