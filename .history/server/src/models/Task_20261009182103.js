import mongoose from 'mongoose';
import { remindable } from './plugins/remindable.js';

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    remindBeforeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'done', 'cancelled', 'failed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal',
    },
  },
  { timestamps: true }
);

taskSchema.plugin(remindable);

o// Common query: all pending tasks for a user, ordered by due date
taskSchema.index({ userId: 1, status: 1, dueAt: 1 });

export const Task = mongoose.model('Task', taskSchema);