import mongoose from 'mongoose';
import { remindable } from './plugins/remindable.js';

const noteSchema = new mongoose.Schema(
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
    body: {
      type: String,
      default: '',
      maxlength: 10000,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

noteSchema.plugin(remindable);

export const Note = mongoose.model('Note', noteSchema);