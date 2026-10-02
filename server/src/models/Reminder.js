import mongoose from 'mongoose';
import { remindable } from './plugins/remindable.js';

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Optional link back to the entity that spawned this reminder
    sourceType: {
      type: String,
      enum: ['manual', 'task', 'note', null],
      default: 'manual',
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.plugin(remindable);

export const Reminder = mongoose.model('Reminder', reminderSchema);