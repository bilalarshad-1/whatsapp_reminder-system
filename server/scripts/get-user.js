import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/index.js';
import mongoose from 'mongoose';

async function main() {
  await connectDB();
  const user = await User.findOne().sort({ createdAt: 1 });
  if (!user) {
    console.log('No users found — run: npm run seed');
  } else {
    console.log('userId    :', user._id.toString());
    console.log('whatsappId:', user.whatsappId);
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });