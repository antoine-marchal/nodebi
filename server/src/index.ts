import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { dashboardsRouter } from './routes/dashboards';
import { queryRouter } from './routes/query';
import { shareRouter } from './routes/share';
import { authRouter, ensureAdmin } from './routes/auth';
import { namespacesRouter } from './routes/namespaces';
import Nedb from '@seald-io/nedb';
import { Dashboard, Namespace, User } from './types';
import { authMiddleware } from './auth';
import { closeMongoPool } from './db/mongo-adapter';
import { PORT, DATA_DIR, USER_DATA_DIR, SECRETS_DIR, ALLOWED_ORIGIN, CLIENT_DIST, PROD } from './config';

[DATA_DIR, USER_DATA_DIR, SECRETS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const dashboardDb = new Nedb<Dashboard>({ filename: path.join(DATA_DIR, 'dashboards.db'), autoload: true });
const usersDb = new Nedb<User>({ filename: path.join(DATA_DIR, 'users.db'), autoload: true });
const namespacesDb = new Nedb<Namespace>({ filename: path.join(DATA_DIR, 'namespaces.db'), autoload: true });
const app = express();

app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api', authMiddleware(usersDb));

app.use('/api', authRouter(usersDb));
app.use('/api/namespaces', namespacesRouter(namespacesDb, dashboardDb));
app.use('/api/dashboards', dashboardsRouter(DATA_DIR, dashboardDb, namespacesDb));
app.use('/api/query', queryRouter(dashboardDb, namespacesDb));
app.use('/api/share', shareRouter(dashboardDb, namespacesDb));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve client build in production
if (PROD && fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

let server: ReturnType<typeof app.listen> | undefined;
async function start() {
  await ensureAdmin(usersDb);
  if (!await namespacesDb.findOneAsync({ _id: 'default' })) await namespacesDb.insertAsync({
    _id: 'default', name: 'Default', description: 'Visible to every authenticated user',
    allowedRoles: ['operator', 'viewer'], allowedUserIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  server = app.listen(PORT, () => {
    console.log(`NodeBI server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}
void start().catch(error => { console.error('NodeBI failed to start:', error); process.exit(1); });

async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down...`);
  server?.close();
  await closeMongoPool();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
