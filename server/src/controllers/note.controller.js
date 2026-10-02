import { Note } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireString, requireDate } from '../utils/validate.js';
import { notFound } from '../utils/http.js';

/**
 * POST /api/notes
 * body: { title, body?, tags?, remindAt }
 */
export const createNote = asyncHandler(async (req, res) => {
  const title = requireString(req.body.title, 'title', { min: 1, max: 200 });
  const body = req.body.body
    ? requireString(req.body.body, 'body', { min: 0, max: 10000 })
    : '';
  const remindAt = requireDate(req.body.remindAt, 'remindAt');

  const tags = Array.isArray(req.body.tags)
    ? req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
    : [];

  const note = await Note.create({
    userId: req.user._id,
    title,
    body,
    tags,
    remindAt,
  });

  res.status(201).json({ ok: true, note });
});

/**
 * GET /api/notes
 */
export const listNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ ok: true, count: notes.length, notes });
});

/**
 * PATCH /api/notes/:id
 */
export const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!note) throw notFound('Note not found');

  if (req.body.title !== undefined) {
    note.title = requireString(req.body.title, 'title', { min: 1, max: 200 });
  }
  if (req.body.body !== undefined) {
    note.body = requireString(req.body.body, 'body', { min: 0, max: 10000 });
  }
  if (req.body.tags !== undefined) {
    note.tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];
  }
  if (req.body.remindAt !== undefined) {
    note.remindAt = requireDate(req.body.remindAt, 'remindAt');
    note.sent = false;
    note.sentAt = null;
    note.attempts = 0;
    note.lastError = null;
  }

  await note.save();
  res.json({ ok: true, note });
});

/**
 * DELETE /api/notes/:id
 */
export const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!note) throw notFound('Note not found');
  res.json({ ok: true, deleted: note._id });
});