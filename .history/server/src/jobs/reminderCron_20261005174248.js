import cron from 'node-cron';
import { Task, Reminder, Note } from '../models/index.js';
import { sendWhatsApp } from '../services/whatsapp.js';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
const CRON_EXPRESSION = '* * * * *';

function formatTask(task) {
  const due = task.dueAt
    ? task.dueAt.toLocaleString('en-PK', {
        timeZone: task.userId.timezone || 'Asia/Karachi',
      })
    : '';
  const lines = [`⏰ *Task reminder*`, task.title];
  if (task.description) lines.push('', task.description);
  if (due) lines.push('', `Due: ${due}`);
  return lines.join('\n');
}

function formatReminder(reminder) {
  return `🔔 *Reminder*\n${reminder.text}`;
}

function formatNote(note) {
  const lines = [`📝 *Note*`, note.title];
  if (note.body) lines.push('', note.body);
  if (note.tags?.length) lines.push('', `#${note.tags.join(' #')}`);
  return lines.join('\n');
}

async function processCollection(Model, format) {
  const now = new Date();

  const candidates = await Model.find({
    sent: false,
    remindAt: { $lte: now },
    attempts: { $lt: MAX_ATTEMPTS },
  })
    .sort({ remindAt: 1 })
    .limit(BATCH_SIZE)
    .select('_id')
    .lean();

  if (candidates.length === 0) return { sent: 0, failed: 0 };

  console.log(`⏱  ${Model.modelName}: ${candidates.length} due`);

  let sentCount = 0;
  let failedCount = 0;

  for (const { _id } of candidates) {
    const claimed = await Model.findOneAndUpdate(
      { _id, sent: false, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    ).populate('userId');

    if (!claimed) continue;

    if (!claimed.userId) {
      await Model.updateOne(
        { _id },
        { $set: { lastError: 'User not found (orphaned doc)' } }
      );
      failedCount++;
      continue;
    }

    if (claimed.userId.active === false) {
      await Model.updateOne(
        { _id },
        { $set: { lastError: 'User inactive' } }
      );
      failedCount++;
      continue;
    }

    try {
      const body = format(claimed);
      await sendWhatsApp(claimed.userId.whatsappId, body);

      await Model.updateOne(
        { _id },
        { $set: { sent: true, sentAt: new Date(), lastError: null } }
      );
      sentCount++;
      console.log(`✅ ${Model.modelName} ${_id} → ${claimed.userId.whatsappId}`);
    } catch (err) {
      const msg = err.waError?.error?.message || err.message || 'unknown error';
      const updates = { lastError: msg };
      if (claimed.attempts >= MAX_ATTEMPTS && Model.modelName === 'Task') {
        updates.status = 'failed';
      }
      await Model.updateOne({ _id }, { $set: updates });
      failedCount++;
      console.error(`❌ ${Model.modelName} ${_id}: ${msg}`);
    }
  }

  return { sent: sentCount, failed: failedCount };
}

export function startReminderCron() {
  console.log(`🕐 Scheduler started — ${CRON_EXPRESSION} (every minute)`);

  cron.schedule(CRON_EXPRESSION, async () => {
    const started = Date.now();
    try {
      const [taskRes, reminderRes, noteRes] = await Promise.all([
        processCollection(Task, formatTask),
        processCollection(Reminder, formatReminder),
        processCollection(Note, formatNote),
      ]);

      const totals = {
        sent: taskRes.sent + reminderRes.sent + noteRes.sent,
        failed: taskRes.failed + reminderRes.failed + noteRes.failed,
      };

      if (totals.sent || totals.failed) {
        console.log(
          `📊 tick done in ${Date.now() - started}ms — sent:${totals.sent} failed:${totals.failed}`
        );
      }
    } catch (err) {
      console.error('💥 cron tick crashed:', err);
    }
  });
}