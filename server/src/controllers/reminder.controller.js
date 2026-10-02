import { Reminder } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireString, requireDate, optionalEnum } from '../utils/validate.js';
import { notFound } from '../utils/http.js';

/**
 * POST /api/reminders
 * body: { text, remindAt }
 */
export const createReminder = asyncHandler(async (req, res) => {
  const text = requireString(req.body.text, 'text', { min: 1, max: 1000 });
  const remindAt = requireDate(req.body.remindAt, 'remindAt');

  const reminder = await Reminder.create({
    userId: req.user._id,
    text,
    remindAt,
    sourceType: 'manual',
  });

  res.status(201).json({ ok: true, reminder });
});

/**
 * GET /api/reminders?includeSent=true
 */
export const listReminders = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.includeSent !== 'true') {
    filter.sent = false;
  }

  const reminders = await Reminder.find(filter)
    .sort({ remindAt: 1 })
    .limit(500);

  res.json({ ok: true, count: reminders.length, reminders });
});

/**
 * PATCH /api/reminders/:id
 */
export const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!reminder) throw notFound('Reminder not found');

  if (req.body.text !== undefined) {
    reminder.text = requireString(req.body.text, 'text', { min: 1, max: 1000 });
  }
  if (req.body.remindAt !== undefined) {
    reminder.remindAt = requireDate(req.body.remindAt, 'remindAt');
    // Re-arm
    reminder.sent = false;
    reminder.sentAt = null;
    reminder.attempts = 0;
    reminder.lastError = null;
  }

  await reminder.save();
  res.json({ ok: true, reminder });
});

/**
 * DELETE /api/reminders/:id
 */
export const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!reminder) throw notFound('Reminder not found');
  res.json({ ok: true, deleted: reminder._id });
});