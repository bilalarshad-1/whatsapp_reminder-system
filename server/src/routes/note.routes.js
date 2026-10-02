import { Router } from 'express';
import {
  createNote,
  listNotes,
  updateNote,
  deleteNote,
} from '../controllers/note.controller.js';

const router = Router();

router.post('/', createNote);
router.get('/', listNotes);
router.patch('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router;