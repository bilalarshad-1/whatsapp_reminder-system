import { Router } from 'express';
import {
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
} from '../controllers/reminder.controller.js';

const router = Router();

router.post('/', createReminder);
router.get('/', listReminders);
router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;