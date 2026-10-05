import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import authRoutes from './auth.routes.js';
import whatsappRoutes from './whatsapp.routes.js';
import systemRoutes from './system.routes.js';
import taskRoutes from './task.routes.js';
import reminderRoutes from './reminder.routes.js';
import noteRoutes from './note.routes.js';

const router = Router();

// Public
router.use('/auth', authRoutes);
router.use('/', whatsappRoutes);
router.use('/', systemRoutes);

// Protected
router.use('/tasks', requireAuth, taskRoutes);
router.use('/reminders', requireAuth, reminderRoutes);
router.use('/notes', requireAuth, noteRoutes);

export default router;