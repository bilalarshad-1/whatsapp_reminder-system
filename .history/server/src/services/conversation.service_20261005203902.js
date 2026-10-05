import { Conversation, User, Task, Note, Reminder } from '../models/index.js';
import { enqueueWhatsApp as sendWhatsApp } from './whatsappQueue.js';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const HELP_TEXT = [
  '*Available commands:*',
  '',
  '• `add task`      — create a task with reminder',
  '• `add reminder`  — create a standalone reminder',
  '• `add note`      — create a note with reminder',
  '• `list`          — show pending items',
  '• `cancel`        — stop current flow',
  '• `help`          — show this message',
].join('\n');

const today = () => new Date();

/**
 * Accepts a variety of date/time inputs from a user and returns a Date in UTC.
 * Returns null if it can't be parsed.
 *
 * Accepted examples:
 *   "2026-10-06 19:40"
 *   "06/10/2026 19:40"
 *   "06-10-2026 19:40"
 *   "in 30 minutes"
 *   "in 2 hours"
 *   "tomorrow 19:40"
 *   "19:40"          (today)
 */
export function parseUserDate(input, tz = 'Asia/Karachi') {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  // relative
  const relMatch = s.match(/^in\s+(\d+)\s*(minute|min|hour|hr|day)s?$/);
  if (relMatch) {
    const n = Number(relMatch[1]);
    const unit = relMatch[2];
    const ms = n * 60_000 * (unit.startsWith('hour') || unit === 'hr' ? 60 : unit === 'day' ? 60 * 24 : 1);
    return new Date(Date.now() + ms);
  }

  // tomorrow HH:mm
  const tomMatch = s.match(/^tomorrow\s+(\d{1,2}):(\d{2})$/);
  if (tomMatch) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(Number(tomMatch[1]), Number(tomMatch[2]), 0, 0);
    return d;
  }

  // HH:mm (today)
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnly) {
    const d = new Date();
    d.setHours(Number(timeOnly[1]), Number(timeOnly[2]), 0, 0);
    if (d < new Date()) d.setDate(d.getDate() + 1);
    return d;
  }

  // yyyy-mm-dd hh:mm
  const isoLike = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ t](\d{1,2}):(\d{2})$/);
  if (isoLike) {
    const [, y, m, d, h, min] = isoLike.map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  }

  // dd/mm/yyyy or dd-mm-yyyy hh:mm
  const euLike = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (euLike) {
    const [, d, m, y, h, min] = euLike.map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
  }

  return null;
}

function fmtDate(d) {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

// ─────────────────────────────────────────────────────────────
// Prompt for a given state
// ─────────────────────────────────────────────────────────────

function promptFor(state, draft = {}) {
  switch (state) {
    case 'task.title':
      return '📝 *New task*\n\nWhat is the *title*?';
    case 'task.description':
      return 'Add a *description* (or send `-` to skip):';
    case 'task.dueAt':
      return 'When is it *due*?\n\nExamples:\n• `in 30 minutes`\n• `tomorrow 19:40`\n• `2026-10-06 19:40`';
    case 'task.remindBefore':
      return 'Remind *how many minutes before due*?\n\nSend a number (e.g. `15`) or `0` for at due time.';
    case 'task.priority':
      return 'Priority? Reply `low`, `normal`, or `high`.';
    case 'note.title':
      return '🗒️ *New note*\n\nWhat is the *title*?';
    case 'note.body':
      return 'Send the note *body*.';
    case 'note.tags':
      return 'Add *tags* separated by commas (e.g. `sales, freight`) or send `-` for none.';
    case 'note.remindAt':
      return 'When should I *remind* you about this note?\n\nExamples: `in 2 hours`, `tomorrow 09:00`, `2026-10-06 19:40`';
    case 'reminder.text':
      return '🔔 *New reminder*\n\nWhat should I remind you about?';
    case 'reminder.remindAt':
      return 'When should I remind you?\n\nExamples: `in 15 minutes`, `tomorrow 08:30`, `2026-10-06 19:40`';
    default:
      return HELP_TEXT;
  }
}

// ─────────────────────────────────────────────────────────────
// Command dispatcher
// ─────────────────────────────────────────────────────────────

const COMMANDS = {
  'add task':     { next: 'task.title',      reset: true },
  'add reminder': { next: 'reminder.text',   reset: true },
  'add note':     { next: 'note.title',      reset: true },
  'help':         { reply: HELP_TEXT },
  'cancel':       { reset: true, reply: 'Cancelled.' },
};

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage({ from, text }) {
  const lower = text.toLowerCase();
  const conv =
    (await Conversation.findOne({ whatsappId: from })) ||
    (await Conversation.create({ whatsappId: from }));

  conv.lastMessageAt = new Date();

  // Global commands
  if (lower === 'help') {
    conv.state = 'idle';
    conv.draft = {};
    await conv.save();
    await sendWhatsApp(from, HELP_TEXT);
    return;
  }

  if (lower === 'cancel') {
    conv.state = 'idle';
    conv.draft = {};
    await conv.save();
    await sendWhatsApp(from, '❌ Cancelled.');
    return;
  }

  if (lower === 'list') {
    await conv.save();
    await sendList(from);
    return;
  }

  // Commands that start a flow
  if (COMMANDS[lower] && lower !== 'help' && lower !== 'cancel') {
    const cmd = COMMANDS[lower];
    conv.state = cmd.next;
    conv.draft = {};
    await conv.save();
    await sendWhatsApp(from, promptFor(cmd.next, conv.draft));
    return;
  }

  // Mid-flow: collect the answer for the current state
  const next = await advanceFlow(conv, text);
  if (next) {
    await sendWhatsApp(from, next);
  }
}

// ─────────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────────

async function advanceFlow(conv, text) {
  const user = conv.userId
    ? await User.findById(conv.userId)
    : await User.findOne({ whatsappId: conv.whatsappId });

  if (!user) {
    // First contact — auto-link or refuse
    return [
      'Hi! I don\'t recognise this WhatsApp id.',
      '',
      'Please register on the web dashboard first, then message me again.',
    ].join('\n');
  }

  if (!conv.userId) {
    conv.userId = user._id;
  }

  const tz = user.timezone || 'Asia/Karachi';

  switch (conv.state) {
    case 'task.title': {
      if (text.length < 1 || text.length > 200) return 'Title must be 1–200 characters.';
      conv.draft.title = text;
      conv.state = 'task.description';
      await conv.save();
      return promptFor('task.description');
    }
    case 'task.description': {
      conv.draft.description = text === '-' ? '' : text.slice(0, 2000);
      conv.state = 'task.dueAt';
      await conv.save();
      return promptFor('task.dueAt');
    }
    case 'task.dueAt': {
      const d = parseUserDate(text, tz);
      if (!d) return 'Could not parse that. Try: `in 30 minutes` or `2026-10-06 19:40`';
      conv.draft.dueAt = d.toISOString();
      conv.state = 'task.remindBefore';
      await conv.save();
      return promptFor('task.remindBefore');
    }
    case 'task.remindBefore': {
      const n = Number(text);
      if (!Number.isInteger(n) || n < 0 || n > 60 * 24 * 30) {
        return 'Send a whole number of minutes (0–43200).';
      }
      conv.draft.remindBeforeMinutes = n;
      conv.state = 'task.priority';
      await conv.save();
      return promptFor('task.priority');
    }
    case 'task.priority': {
      const p = text.toLowerCase();
      if (!['low', 'normal', 'high'].includes(p)) return 'Reply `low`, `normal`, or `high`.';
      conv.draft.priority = p;

      const dueAt = new Date(conv.draft.dueAt);
      const remindAt = new Date(dueAt.getTime() - conv.draft.remindBeforeMinutes * 60_000);

      const task = await Task.create({
        userId: user._id,
        title: conv.draft.title,
        description: conv.draft.description || '',
        dueAt,
        remindAt,
        remindBeforeMinutes: conv.draft.remindBeforeMinutes,
        priority: conv.draft.priority,
      });

      conv.state = 'idle';
      conv.draft = {};
      await conv.save();

      return [
        '✅ *Task created*',
        '',
        `*${task.title}*`,
        task.description ? task.description : '',
        `Due: ${fmtDate(dueAt)}`,
        `Remind: ${fmtDate(remindAt)}`,
        `Priority: ${task.priority}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'reminder.text': {
      if (text.length < 1 || text.length > 1000) return 'Text must be 1–1000 characters.';
      conv.draft.text = text;
      conv.state = 'reminder.remindAt';
      await conv.save();
      return promptFor('reminder.remindAt');
    }
    case 'reminder.remindAt': {
      const d = parseUserDate(text, tz);
      if (!d) return 'Could not parse that. Try: `in 15 minutes` or `2026-10-06 19:40`';

      const reminder = await Reminder.create({
        userId: user._id,
        text: conv.draft.text,
        remindAt: d,
        sourceType: 'manual',
      });

      conv.state = 'idle';
      conv.draft = {};
      await conv.save();

      return [
        '✅ *Reminder created*',
        '',
        reminder.text,
        `When: ${fmtDate(d)}`,
      ].join('\n');
    }

    case 'note.title': {
      if (text.length < 1 || text.length > 200) return 'Title must be 1–200 characters.';
      conv.draft.title = text;
      conv.state = 'note.body';
      await conv.save();
      return promptFor('note.body');
    }
    case 'note.body': {
      conv.draft.body = text.slice(0, 10000);
      conv.state = 'note.tags';
      await conv.save();
      return promptFor('note.tags');
    }
    case 'note.tags': {
      conv.draft.tags =
        text === '-'
          ? []
          : text.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20);
      conv.state = 'note.remindAt';
      await conv.save();
      return promptFor('note.remindAt');
    }
    case 'note.remindAt': {
      const d = parseUserDate(text, tz);
      if (!d) return 'Could not parse that. Try: `in 2 hours` or `2026-10-06 09:00`';

      const note = await Note.create({
        userId: user._id,
        title: conv.draft.title,
        body: conv.draft.body,
        tags: conv.draft.tags,
        remindAt: d,
      });

      conv.state = 'idle';
      conv.draft = {};
      await conv.save();

      return [
        '✅ *Note created*',
        '',
        `*${note.title}*`,
        note.body,
        note.tags?.length ? `#${note.tags.join(' #')}` : '',
        `Remind: ${fmtDate(d)}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'idle':
    default:
      return HELP_TEXT;
  }
}

// ─────────────────────────────────────────────────────────────
// list command
// ─────────────────────────────────────────────────────────────

async function sendList(from) {
  const user = await User.findOne({ whatsappId: from });
  if (!user) {
    return sendWhatsApp(from, 'Register on the web dashboard first.');
  }
  const now = new Date();
  const [tasks, reminders, notes] = await Promise.all([
    Task.find({ userId: user._id, status: 'pending', sent: false }).sort({ remindAt: 1 }).limit(5),
    Reminder.find({ userId: user._id, sent: false }).sort({ remindAt: 1 }).limit(5),
    Note.find({ userId: user._id, sent: false }).sort({ remindAt: 1 }).limit(5),
  ]);

  const parts = ['📋 *Upcoming*'];
  if (tasks.length) {
    parts.push('\n*Tasks*');
    for (const t of tasks) parts.push(`• ${t.title} — ${fmtDate(t.dueAt)}`);
  }
  if (reminders.length) {
    parts.push('\n*Reminders*');
    for (const r of reminders) parts.push(`• ${r.text} — ${fmtDate(r.remindAt)}`);
  }
  if (notes.length) {
    parts.push('\n*Notes*');
    for (const n of notes) parts.push(`• ${n.title} — ${fmtDate(n.remindAt)}`);
  }
  if (parts.length === 1) parts.push('\nNothing pending.');

  return sendWhatsApp(from, parts.join('\n'));
}