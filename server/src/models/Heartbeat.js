import mongoose from 'mongoose';

const heartbeatSchema = new mongoose.Schema({
  key:     { type: String, unique: true },
  lastRunAt: Date,
  sent:    { type: Number, default: 0 },
  failed:  { type: Number, default: 0 },
});

export const Heartbeat = mongoose.model('Heartbeat', heartbeatSchema);