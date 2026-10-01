import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import User from '../models/User.js';

// Resolve backend/.env relative to this script so the command works from any cwd.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

function promptForPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env when running without an interactive terminal.'));
      return;
    }

    let password = '';
    const input = process.stdin;
    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Admin creation cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter' || character === '\r' || character === '\n') {
        cleanup();
        resolve(password);
      } else if (key.name === 'backspace') {
        password = password.slice(0, -1);
      } else if (character && !key.ctrl && !key.meta) {
        password += character;
      }
    };

    process.stdout.write('Admin password (input hidden): ');
    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
  });
}

async function readConfig() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env.');
  let email = process.env.ADMIN_EMAIL?.trim();
  let name = process.env.ADMIN_NAME?.trim();
  let password = process.env.ADMIN_PASSWORD;

  if ((!email || !password) && process.stdin.isTTY && process.stdout.isTTY) {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!email) email = (await terminal.question('Admin email: ')).trim();
      if (!name) name = (await terminal.question('Admin name [Workspace Admin]: ')).trim();
    } finally {
      terminal.close();
    }
    if (!password) password = await promptForPassword();
  }

  email = email?.trim().toLowerCase();
  name = name?.trim() || 'Workspace Admin';
  const missing = [];
  if (!email) missing.push('ADMIN_EMAIL');
  if (!password) missing.push('ADMIN_PASSWORD');
  if (missing.length) throw new Error(`Set ${missing.join(' and ')} in backend/.env or run this command in an interactive terminal.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.');
  if (!password || password.length < 8 || password.length > 128) {
    throw new Error('Set ADMIN_PASSWORD to a value between 8 and 128 characters in backend/.env.');
  }
  if (name.length > 80) throw new Error('ADMIN_NAME must be 80 characters or fewer.');

  return { email, name, password, mongoUri: process.env.MONGODB_URI };
}

async function main() {
  let connected = false;

  try {
    const { email, name, password, mongoUri } = await readConfig();
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    connected = true;

    if (await User.exists({ email })) {
      throw new Error(`An account with ${email} already exists. Use the separate promote-admin command only if you intend to grant it admin access.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ name, email, passwordHash, role: 'admin' });
    console.log(`Admin account created: ${admin.email}`);
  } catch (error) {
    if (error.code === 11000) {
      console.error('Admin account was not created: that email is already registered.');
    } else if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoServerSelectionError') {
      console.error('Admin account was not created: MongoDB is unreachable. Check MONGODB_URI and make sure MongoDB is running.');
    } else {
      console.error(`Admin account was not created: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

await main();
