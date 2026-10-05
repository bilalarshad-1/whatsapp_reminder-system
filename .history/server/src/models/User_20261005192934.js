import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default
    },
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

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    whatsappId: this.whatsappId,
    timezone: this.timezone,
    active: this.active,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);