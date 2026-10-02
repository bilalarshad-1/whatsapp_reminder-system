import mongoose from 'mongoose';

/**
 * Adds reminder-tracking fields to a schema.
 * Use on any model that needs to be picked up by the cron scheduler.
 */
export function remindable(schema, options = {}) {
  schema.add({
    remindAt: {
      type: Date,
      required: true,
      index: true,
    },
    sent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
  });

  // The exact index the cron in Phase 5 will use.
  schema.index({ sent: 1, remindAt: 1 });

  // Mongoose 7+ requires async hooks (no callback "next")
  schema.pre('save', async function () {
    if (this.isModified('dueAt') && !this.isModified('remindAt') && this.dueAt) {
      const offsetMs = (options.remindBeforeMinutes ?? 0) * 60_000;
      this.remindAt = new Date(this.dueAt.getTime() - offsetMs);
    }
  });
}