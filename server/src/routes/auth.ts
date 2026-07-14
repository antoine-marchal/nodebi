import { Router, Request, Response } from 'express';
import Nedb from '@seald-io/nedb';
import bcrypt from 'bcryptjs';
import http from 'http';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { createAccessToken, requireRole } from '../auth';
import { ADMIN_LOGIN, ADMIN_PASSWORD, PROXYAUTH_LOGIN_URL, PROXYAUTH_NAME, PROXYAUTH_REGEX, PROXYAUTH_URL, PUBLIC_URL } from '../config';
import { Role, User } from '../types';

const ROLES: Role[] = ['admin', 'operator', 'viewer'];
const publicUser = (u: User) => ({ _id: u._id, login: u.login, role: u.role, createdAt: u.createdAt });

export async function ensureAdmin(users: Nedb<User>) {
  if (await users.findOneAsync({ login: ADMIN_LOGIN })) return;
  const now = new Date().toISOString();
  await users.insertAsync({ _id: uuidv4(), login: ADMIN_LOGIN, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin', createdAt: now, updatedAt: now });
  console.log(`Created initial NodeBI admin user '${ADMIN_LOGIN}'.`);
}

function requestText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, response => { let data = ''; response.on('data', c => data += c); response.on('end', () => resolve(data)); }).on('error', reject);
  });
}

export function authRouter(users: Nedb<User>): Router {
  const router = Router();

  router.post('/auth/login', async (req: Request, res: Response) => {
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await users.findOneAsync({ login });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ accessToken: createAccessToken(user), user: publicUser(user) });
  });

  router.get('/auth/me', async (req: Request, res: Response) => {
    const user = req.user && await users.findOneAsync({ _id: req.user._id });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(publicUser(user));
  });

  router.get('/auth-proxy/config', (_req, res) => res.json({
    enabled: !!(PROXYAUTH_URL && PROXYAUTH_REGEX), paramName: PROXYAUTH_NAME,
    loginUrl: PROXYAUTH_LOGIN_URL || undefined, service: PUBLIC_URL,
  }));

  router.get('/auth-proxy', async (req, res) => {
    if (!PROXYAUTH_URL || !PROXYAUTH_REGEX) return res.status(503).json({ error: 'Proxy authentication is not configured' });
    const ticket = String(req.query[PROXYAUTH_NAME] || '');
    if (!ticket) return res.status(400).json({ error: `Missing query parameter: ${PROXYAUTH_NAME}` });
    try {
      const separator = PROXYAUTH_URL.includes('?') ? '&' : '?';
      const body = await requestText(`${PROXYAUTH_URL}${separator}${encodeURIComponent(PROXYAUTH_NAME)}=${encodeURIComponent(ticket)}&service=${encodeURIComponent(PUBLIC_URL)}`);
      const match = body.match(new RegExp(PROXYAUTH_REGEX));
      const login = match?.[1]?.trim().toLowerCase();
      const user = login ? await users.findOneAsync({ login }) : null;
      if (!user) return res.status(401).json({ error: 'Proxy-authenticated user is not registered in NodeBI' });
      res.json({ accessToken: createAccessToken(user), user: publicUser(user) });
    } catch (e: any) { res.status(502).json({ error: e?.message || 'Proxy authentication failed' }); }
  });

  router.get('/users', requireRole('admin'), async (_req, res) => res.json((await users.findAsync({})).map(publicUser)));
  router.post('/users', requireRole('admin'), async (req, res) => {
    const login = String(req.body?.login || '').trim().toLowerCase();
    const password = req.body?.password ? String(req.body.password) : '';
    const role = req.body?.role as Role;
    if (!login || !ROLES.includes(role)) return res.status(400).json({ error: 'A login and valid role are required' });
    if (await users.findOneAsync({ login })) return res.status(409).json({ error: 'User already exists' });
    const now = new Date().toISOString();
    const user: User = { _id: uuidv4(), login, passwordHash: password ? await bcrypt.hash(password, 12) : null, role, createdAt: now, updatedAt: now };
    await users.insertAsync(user); res.status(201).json(publicUser(user));
  });
  router.patch('/users/:id', requireRole('admin'), async (req, res) => {
    const target = await users.findOneAsync({ _id: req.params.id });
    if (!target) return res.status(404).json({ error: 'User not found' });
    const role = req.body?.role as Role | undefined;
    const password = req.body?.password ? String(req.body.password) : undefined;
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (target.role === 'admin' && role && role !== 'admin' && await users.countAsync({ role: 'admin' }) <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
    const patch: Partial<User> = { updatedAt: new Date().toISOString() };
    if (role) patch.role = role;
    if (password) patch.passwordHash = await bcrypt.hash(password, 12);
    await users.updateAsync({ _id: target._id }, { $set: patch }, {});
    res.json(publicUser((await users.findOneAsync({ _id: target._id }))!));
  });
  router.delete('/users/:id', requireRole('admin'), async (req, res) => {
    const target = await users.findOneAsync({ _id: req.params.id });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin' && await users.countAsync({ role: 'admin' }) <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
    await users.removeAsync({ _id: target._id }, {}); res.json({ success: true });
  });
  return router;
}
