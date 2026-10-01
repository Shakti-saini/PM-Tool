import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import app from './app.js';
import Project from './models/Project.js';
import User from './models/User.js';

for (const name of ['MONGODB_URI', 'JWT_SECRET']) if (!process.env[name]) throw new Error(`${name} is required`);
if (process.env.JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be at least 32 characters in production');
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) throw new Error('REDIS_URL is required in production');

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()) } });
app.set('io', io);

let redisPub;
if (process.env.REDIS_URL) {
  redisPub = new Redis(process.env.REDIS_URL);
  const redisSub = redisPub.duplicate();
  await Promise.all([redisPub.ping(), redisSub.ping()]);
  io.adapter(createAdapter(redisPub, redisSub));
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = sub;
    next();
  } catch { next(new Error('Invalid or expired token')); }
});

io.on('connection', async socket => {
  socket.join(`user:${socket.data.userId}`);
  const connectedUser = await User.findById(socket.data.userId).select('role');
  if (connectedUser?.role === 'admin') socket.join('admins');
  socket.on('project:join', async ({ projectId } = {}, callback = () => {}) => {
    try {
      const user = await User.findById(socket.data.userId).select('role');
      const member = user?.role === 'admin' || await Project.exists({ _id: projectId, members: socket.data.userId });
      if (!member) return callback({ error: 'Project not found or access denied' });
      await socket.join(projectId);
      callback({ ok: true });
    } catch { callback({ error: 'Unable to join project room' }); }
  });
  socket.on('project:leave', ({ projectId } = {}) => { if (projectId) socket.leave(projectId); });
});

await mongoose.connect(process.env.MONGODB_URI);
const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`Teamboard API listening on port ${port}`));

async function shutdown() {
  server.close();
  io.close();
  await mongoose.disconnect();
  if (redisPub) await redisPub.quit();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
