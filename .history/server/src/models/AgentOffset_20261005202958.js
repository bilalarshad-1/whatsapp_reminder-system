import mongoose from 'mongoose';

const agentOffsetSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  offset: { type: Number, default: 0 },
});

export const AgentOffset = mongoose.model('AgentOffset', agentOffsetSchema);