// No dotenv import here — env.js handles it
import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User, Task, Reminder, Note } from '../src/models/index.js';

async function seed() {
  await connectDB();
  console.log('   using DB:', mongoose.connection.name);

  // Wipe (dev only!)
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Reminder.deleteMany({}),
    Note.deleteMany({}),
  ]);

  const user = await User.create({
    name: 'Test User',
    whatsappId: process.env.SEED_WHATSAPP_ID || 'user:233710897094724',
    timezone: 'Asia/Karachi',
  });

  const now = Date.now();

  await Task.create({
    userId: user._id,
    title: 'Prepare freight quote',
    description: 'For customer X, shipment 20ft container',
    dueAt: new Date(now + 60 * 60 * 1000),
    remindAt: new Date(now + 55 * 60 * 1000),
    remindBeforeMinutes: 5,
    priority: 'high',
  });

  await Reminder.create({
    userId: user._id,
    text: 'Call Ahmed about the Karachi shipment',
    remindAt: new Date(now + 2 * 60 * 1000),
    sourceType: 'manual',
  });

  await Note.create({
    userId: user._id,
    title: 'Rate negotiation notes',
    body: 'Ahmed wants 5% discount if we commit to 10 shipments.',
    tags: ['sales', 'freight'],
    remindAt: new Date(now + 5 * 60 * 1000),
  });

  console.log('✅ Seed complete');
  console.log('   user:', user._id.toString());
  console.log('   whatsappId:', user.whatsappId);
  console.log('   DB:', mongoose.connection.name);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});