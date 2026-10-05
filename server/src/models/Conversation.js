import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    whatsappId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    state: {
      type: String,
      enum: [
        'idle',
        'task.title',
        'task.description',
        'task.dueAt',
        'task.remindBefore',
        'task.priority',
        'note.title',
        'note.body',
        'note.tags',
        'note.remindAt',
        'reminder.text',
        'reminder.remindAt',
      ],
      default: 'idle',
    },
    draft: {
      // holds partial data while in a flow
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);