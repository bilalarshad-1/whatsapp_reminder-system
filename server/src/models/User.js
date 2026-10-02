import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // WhatsApp Agent recipient id — always "user:123456789"
    whatsappId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: (v) => /^user:\d+$/.test(v),
        message: 'whatsappId must be in the form "user:<digits>"',
      },
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);