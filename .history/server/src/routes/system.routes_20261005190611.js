import { Router } from 'express';
import { healthDetailed } from '../controllers/system.controller.js';

const router = Router();
router.get('/system/health', healthDetailed);
export default router;