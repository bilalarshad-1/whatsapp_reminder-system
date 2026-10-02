import { Router } from 'express';
import whatsappRoutes from './whatsapp.routes.js';

const router = Router();

router.use('/', whatsappRoutes); // Phase 2
// router.use('/tasks', taskRoutes);       // Phase 4
// router.use('/reminders', reminderRoutes); // Phase 4
// router.use('/notes', noteRoutes);       // Phase 4

export default router;