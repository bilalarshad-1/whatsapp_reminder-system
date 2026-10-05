import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import whatsappRoutes from './whatsapp.routes.js';
import taskRoutes from './task.routes.js';
import reminderRoutes from './reminder.routes.js';
import noteRoutes from './note.routes.js';
import systemRoutes from './system.routes.js';

const router = Router();

// Public (no user required) — WhatsApp diagnostic endpoint
router.use('/', whatsappRoutes);
router.use('/', systemRoutes);  // public, no user needed
// User-scoped routes
router.use('/tasks', requireUser, taskRoutes);
router.use('/reminders', requireUser, reminderRoutes);
router.use('/notes', requireUser, noteRoutes);

export default router;