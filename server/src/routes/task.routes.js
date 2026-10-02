import { Router } from 'express';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  markTaskDone,
} from '../controllers/task.controller.js';

const router = Router();

router.post('/', createTask);
router.get('/', listTasks);
router.get('/:id', getTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/done', markTaskDone);

export default router;