// server/scripts/reset-offset.js
import { connectDB } from '../src/config/db.js';
import { AgentOffset } from '../src/models/index.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  await AgentOffset.updateOne(
    { key: 'whatsapp-agent' },
    { $set: { offset: Number(process.argv[2] || 0) } },
    { upsert: true }
  );
  console.log('Offset set to', process.argv[2] || 0);
  await mongoose.disconnect();
}

main();