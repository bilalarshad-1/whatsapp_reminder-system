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

const DATE_HINT = [
  'Send the date and time in one of these formats:',
  '',
  '• `10/05/2026/09:00:pm`   (MM/DD/YYYY/HH:MM:am|pm)',
  '• `10/05/2026 21:00`      (MM/DD/YYYY HH:MM, 24-hour)',
  '• `2026-10-05 21:00`      (ISO-like)',
  '• `in 30 minutes`',
  '• `tomorrow 09:00`',
  '• `09:00 pm`',
  '• `21:00`',
].join('\n');

/**
 * Parse a wide range of date/time inputs and return a local Date object.
 * Returns null if nothing matches.
 *
 * Local timezone comes from the OS (the process env TZ). All returned Dates
 * are in the server's local zone, which is fine because they will be stored
 * as UTC via .toISOString() by Mongo.
 *
 * Supported inputs:
 *   "10/05/2026/09:00:pm"     → MM/DD/YYYY/HH:MM:am|pm  (your requested format)
 *   "10/05/2026/9:00:pm"      → same, single-digit hour
 *   "10/05/2026 09:00 pm"     → space between date & time, space before am/pm
 *   "10/05/2026 21:00"        → 24-hour
 *   "2026-10-05 21:00"        → ISO-like with space
 *   "2026-10-05T21:00"        → ISO-like with T
 *   "09:00 pm"                → today, or tomorrow if already past
 *   "21:00"                   → today, or tomorrow if already past
 *   "in 30 minutes" / "in 2 hours" / "in 1 day"
 *   "tomorrow 09:00"
 *   "today 21:00"
 */
export function parseUserDate(input) {
  if (input === undefined || input === null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const s = raw.toLowerCase().replace(/\s+/g, ' ');

  // ── Relative: "in N minutes|mins|hours|hrs|days"
  const rel = s.match(/^in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)$/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    let ms = n * 60_000;
    if (/^hours?$/.test(unit) || /^hrs?$/.test(unit)) ms = n * 3_600_000;
    if (/^days?$/.test(unit)) ms = n * 86_400_000;
    return new Date(Date.now() + ms);
  }

  // ── "today HH:MM[ am|pm]" / "tomorrow HH:MM[ am|pm]"
  const relDay = s.match(/^(today|tomorrow)\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (relDay) {
    const [, day, hStr, mStr, mer] = relDay;
    let h = Number(hStr);
    const m = Number(mStr);
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    const d = new Date();
    if (day === 'tomorrow') d.setDate(d.getDate() + 1);
    d.setHours(h, m, 0, 0);
    return d;
  }

  // ── Time only: "HH:MM[ am|pm]" (today, or tomorrow if already past)
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (timeOnly) {
    let h = Number(timeOnly[1]);
    const m = Number(timeOnly[2]);
    const mer = timeOnly[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (h > 23 || m > 59) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }

  // ── PRIMARY: MM/DD/YYYY/HH:MM:am|pm  (your requested format)
  //    Also accepts single-digit month/day/hour and missing leading zeros.
  const slashAmPm = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\/(\d{1,2}):(\d{2}):?\s*(am|pm)\.?$/
  );
  if (slashAmPm) {
    const [, mm, dd, yyyy, hh, min, mer] = slashAmPm;
    return buildDate(yyyy, mm, dd, hh, min, mer);
  }

  // ── MM/DD/YYYY HH:MM[ am|pm]   (space instead of second slash)
  const slashSpace = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?\.?$/
  );
  if (slashSpace) {
    const [, mm, dd, yyyy, hh, min, mer] = slashSpace;
    return buildDate(yyyy, mm, dd, hh, min, mer);
  }

  // ── ISO-like: YYYY-MM-DD[T or space]HH:MM[:SS][am|pm]
  const isoLike = s.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[ t](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\.?$/
  );
  if (isoLike) {
    const [, yyyy, mm, dd, hh, min, , mer] = isoLike;
    return buildDate(yyyy, mm, dd, hh, min, mer);
  }

  // Nothing matched
  console.warn('⚠️  parseUserDate could not parse input:', JSON.stringify(input));
  return null;
}

/**
 * Build a Date from parts, handling 12-hour → 24-hour conversion and
 * validating the ranges. Returns null on invalid input.
 */
function buildDate(yyyy, mm, dd, hh, min, mer) {
  const Y = Number(yyyy);
  const M = Number(mm);
  const D = Number(dd);
  let H = Number(hh);
  const Mi = Number(min);

  if (M < 1 || M > 12) return null;
  if (D < 1 || D > 31) return null;
  if (H < 0 || H > 23) return null;
  if (Mi < 0 || Mi > 59) return null;

  if (mer === 'pm' && H < 12) H += 12;
  if (mer === 'am' && H === 12) H = 0;

  const d = new Date(Y, M - 1, D, H, Mi, 0, 0);
  // Reject rollovers like "02/30/2026" which JS silently converts
  if (d.getFullYear() !== Y || d.getMonth() !== M - 1 || d.getDate() !== D) {
    return null;
  }
  return d;
}

function fmtDate(d, tz = 'Asia/Karachi') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d) + ` (${tz})`;
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}

// ─────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────

function promptFor(state) {
  switch (state) {
    case 'task.title':
      return '📝 *New task*\n\nWhat is the *title*?';
    case 'task.description':
      return 'Add a *description* (or send `-` to skip):';
    case 'task.dueAt':
      return `When is it *due*?\n\n${DATE_HINT}`;
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
      return `When should I *remind* you about this note?\n\n${DATE_HINT}`;
    case 'reminder.text':
      return '🔔 *New reminder*\n\nWhat should I remind you about?';
    case 'reminder.remindAt':
      return `When should I remind you?\n\n${DATE_HINT}`;
    default:
      return HELP_TEXT;
  }
}

// ─────────────────────────────────────────────────────────────
// Command map
// ─────────────────────────────────────────────────────────────

const COMMANDS = {
  'add task':     { next: 'task.title' },
  'add reminder': { next: 'reminder.text' },
  'add note':     { next: 'note.title' },
};

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

export async function handleIncomingMessage({ from, text }) {
  const lower = String(text || '').trim().toLowerCase();
  if (!lower) return;

  const conv =
    (await Conversation.findOne({ whatsappId: from })) ||
    (await Conversation.create({ whatsappId: from }));

  // Dedup: ignore exact same message within 30s
  if (
    conv.draft?.__lastText === text &&
    conv.draft?.__lastAt &&
    Date.now() - new Date(conv.draft.__lastAt).getTime() < 30_000
  ) {
    console.log('🔁 duplicate ignored from', from);
    return;
  }

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
    conv.draft = { ...(conv.draft || {}), __lastText: text, __lastAt: new Date().toISOString() };
    await conv.save();
    await sendList(from);
    return;
  }

  // Start a flow
  if (COMMANDS[lower]) {
    conv.state = COMMANDS[lower].next;
    conv.draft = { __lastText: text, __lastAt: new Date().toISOString() };
    await conv.save();
    await sendWhatsApp(from, promptFor(conv.state));
    return;
  }

  // Continue an existing flow
  const reply = await advanceFlow(conv, text);
  if (reply) {
    await sendWhatsApp(from, reply);
  }
}

// ─────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────

async function advanceFlow(conv, text) {
  const user = conv.userId
    ? await User.findById(conv.userId)
    : await User.findOne({ whatsappId: conv.whatsappId });

  if (!user) {
    return [
      'Hi! I don\'t recognise this WhatsApp id.',
      '',
      'Please register on the web dashboard first, then message me again.',
    ].join('\n');
  }

  if (!conv.userId) conv.userId = user._id;

  // Update dedup fields before saving at end of every branch
  const stamp = () => {
    conv.draft = {
      ...(conv.draft || {}),
      __lastText: text,
      __lastAt: new Date().toISOString(),
    };
  };

  switch (conv.state) {
    // ── TASK ────────────────────────────────────────────────
    case 'task.title': {
      const t = String(text).trim();
      if (t.length < 1 || t.length > 200) return 'Title must be 1–200 characters.';
      conv.draft.title = t;
      conv.state = 'task.description';
      stamp();
      await conv.save();
      return promptFor('task.description');
    }

    case 'task.description': {
      conv.draft.description = text === '-' ? '' : String(text).slice(0, 2000);
      conv.state = 'task.dueAt';
      stamp();
      await conv.save();
      return promptFor('task.dueAt');
    }

    case 'task.dueAt': {
      const d = parseUserDate(text);
      if (!d) return `Could not parse that.\n\n${DATE_HINT}`;
      conv.draft.dueAt = d.toISOString();
      conv.state = 'task.remindBefore';
      stamp();
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
      stamp();
      await conv.save();
      return promptFor('task.priority');
    }

    case 'task.priority': {
      const p = String(text).trim().toLowerCase();
      if (!['low', 'normal', 'high'].includes(p)) {
        return 'Reply `low`, `normal`, or `high`.';
      }

      // Guard everything before creating
      const dueAt = new Date(conv.draft.dueAt);
      const offsetMin = Number(conv.draft.remindBeforeMinutes) || 0;
      if (isNaN(dueAt.getTime())) {
        conv.state = 'task.dueAt';
        conv.draft = {};
        await conv.save();
        return `Something went wrong with the date.\n\n${promptFor('task.dueAt')}`;
      }
      const remindAt = new Date(dueAt.getTime() - offsetMin * 60_000);

      let task;
      try {
        task = await Task.create({
          userId: user._id,
          title: conv.draft.title,
          description: conv.draft.description || '',
          dueAt,
          remindAt,
          remindBeforeMinutes: offsetMin,
          priority: p,
        });
      } catch (err) {
        console.error('create task failed:', err.message);
        conv.state = 'task.title';
        conv.draft = {};
        await conv.save();
        return `❌ Failed to create the task. Starting over.\n\n${promptFor('task.title')}`;
      }

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

    // ── REMINDER ────────────────────────────────────────────
    case 'reminder.text': {
      const t = String(text).trim();
      if (t.length < 1 || t.length > 1000) return 'Text must be 1–1000 characters.';
      conv.draft.text = t;
      conv.state = 'reminder.remindAt';
      stamp();
      await conv.save();
      return promptFor('reminder.remindAt');
    }

    case 'reminder.remindAt': {
      const d = parseUserDate(text);
      if (!d || isNaN(d.getTime())) {
        return `Could not parse that.\n\n${DATE_HINT}`;
      }

      let reminder;
      try {
        reminder = await Reminder.create({
          userId: user._id,
          text: conv.draft.text,
          remindAt: d,
          sourceType: 'manual',
        });
      } catch (err) {
        console.error('create reminder failed:', err.message);
        conv.state = 'reminder.text';
        conv.draft = {};
        await conv.save();
        return `❌ Failed to create the reminder. Starting over.\n\n${promptFor('reminder.text')}`;
      }

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

    // ── NOTE ────────────────────────────────────────────────
    case 'note.title': {
      const t = String(text).trim();
      if (t.length < 1 || t.length > 200) return 'Title must be 1–200 characters.';
      conv.draft.title = t;
      conv.state = 'note.body';
      stamp();
      await conv.save();
      return promptFor('note.body');
    }

    case 'note.body': {
      conv.draft.body = String(text).slice(0, 10000);
      conv.state = 'note.tags';
      stamp();
      await conv.save();
      return promptFor('note.tags');
    }

    case 'note.tags': {
      conv.draft.tags =
        text === '-'
          ? []
          : String(text)
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 20);
      conv.state = 'note.remindAt';
      stamp();
      await conv.save();
      return promptFor('note.remindAt');
    }

    case 'note.remindAt': {
      const d = parseUserDate(text);
      if (!d || isNaN(d.getTime())) {
        return `Could not parse that.\n\n${DATE_HINT}`;
      }

      let note;
      try {
        note = await Note.create({
          userId: user._id,
          title: conv.draft.title,
          body: conv.draft.body,
          tags: conv.draft.tags,
          remindAt: d,
        });
      } catch (err) {
        console.error('create note failed:', err.message);
        conv.state = 'note.title';
        conv.draft = {};
        await conv.save();
        return `❌ Failed to create the note. Starting over.\n\n${promptFor('note.title')}`;
      }

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

    // ── Fallback ────────────────────────────────────────────
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