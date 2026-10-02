import { Task } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireString, requireDate, optionalInt, optionalEnum } from '../utils/validate.js';
import { notFound } from '../utils/http.js';

/**
 * POST /api/tasks
 * body: { title, description?, dueAt, remindBeforeMinutes?, priority? }
 */
export const createTask = asyncHandler(async (req, res) => {
  const title = requireString(req.body.title, 'title', { min: 1, max: 200 });
  const description = req.body.description
    ? requireString(req.body.description, 'description', { min: 0, max: 2000 })
    : '';
  const dueAt = requireDate(req.body.dueAt, 'dueAt');
  const remindBeforeMinutes = optionalInt(
    req.body.remindBeforeMinutes,
    'remindBeforeMinutes',
    { min: 0, max: 60 * 24 * 30 }
  ) ?? 0;
  const priority = optionalEnum(
    req.body.priority,
    'priority',
    ['low', 'normal', 'high'],
    'normal'
  );

  // Compute remindAt from dueAt - offset
  const remindAt = new Date(dueAt.getTime() - remindBeforeMinutes * 60_000);

  const task = await Task.create({
    userId: req.user._id,
    title,
    description,
    dueAt,
    remindAt,
    remindBeforeMinutes,
    priority,
  });

  res.status(201).json({ ok: true, task });
});

/**
 * GET /api/tasks?status=pending&limit=50
 */
export const listTasks = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const tasks = await Task.find(filter)
    .sort({ dueAt: 1 })
    .limit(limit);

  res.json({ ok: true, count: tasks.length, tasks });
});

/**
 * GET /api/tasks/:id
 */
export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!task) throw notFound('Task not found');
  res.json({ ok: true, task });
});

/**
 * PATCH /api/tasks/:id
 * Recomputes remindAt if dueAt or remindBeforeMinutes changes, and
 * resets sent=false so the scheduler will re-fire.
 */
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!task) throw notFound('Task not found');

  if (req.body.title !== undefined) {
    task.title = requireString(req.body.title, 'title', { min: 1, max: 200 });
  }
  if (req.body.description !== undefined) {
    task.description = requireString(req.body.description, 'description', { min: 0, max: 2000 });
  }
  if (req.body.priority !== undefined) {
    task.priority = optionalEnum(req.body.priority, 'priority', ['low', 'normal', 'high'], 'normal');
  }
  if (req.body.status !== undefined) {
    task.status = optionalEnum(
      req.body.status,
      'status',
      ['pending', 'done', 'cancelled', 'failed'],
      'pending'
    );
  }

  const dueChanged = req.body.dueAt !== undefined;
  const offsetChanged = req.body.remindBeforeMinutes !== undefined;

  if (dueChanged) task.dueAt = requireDate(req.body.dueAt, 'dueAt');
  if (offsetChanged) {
    task.remindBeforeMinutes = optionalInt(
      req.body.remindBeforeMinutes,
      'remindBeforeMinutes',
      { min: 0, max: 60 * 24 * 30 }
    );
  }

  if (dueChanged || offsetChanged) {
    task.remindAt = new Date(task.dueAt.getTime() - task.remindBeforeMinutes * 60_000);
    // Re-arm the scheduler
    task.sent = false;
    task.sentAt = null;
    task.attempts = 0;
    task.lastError = null;
  }

  await task.save();
  res.json({ ok: true, task });
});

/**
 * DELETE /api/tasks/:id
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!task) throw notFound('Task not found');
  res.json({ ok: true, deleted: task._id });
});

/**
 * POST /api/tasks/:id/done
 * Convenience for the UI checkbox.
 */
export const markTaskDone = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { status: 'done' } },
    { new: true }
  );
  if (!task) throw notFound('Task not found');
  res.json({ ok: true, task });
});