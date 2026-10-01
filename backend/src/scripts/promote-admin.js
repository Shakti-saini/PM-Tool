import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

if (!process.env.MONGODB_URI || !process.env.ADMIN_EMAIL) throw new Error('MONGODB_URI and ADMIN_EMAIL are required');
await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOneAndUpdate({ email: process.env.ADMIN_EMAIL.toLowerCase() }, { $set: { role: 'admin' } }, { new: true });
if (!user) {
  await mongoose.disconnect();
  throw new Error('Register this account first, then run the promotion command again');
}
console.log(`Administrator role granted to ${user.email}`);
await mongoose.disconnect();
