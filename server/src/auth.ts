import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Nedb from '@seald-io/nedb';
import { AUTH_TOKEN, JWT_SECRET } from './config';
import { Role, User } from './types';

export interface AuthUser { _id: string; login: string; role: Role }

declare global {
  // Express exposes request augmentation through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

export function createAccessToken(user: Pick<User, '_id' | 'login' | 'role'>): string {
  return jwt.sign({ _id: user._id, login: user.login, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export function authMiddleware(users: Nedb<User>) {
  return async (req: Request, res: Response, next: NextFunction) => {
  const p = req.path.replace(/^\/api/, '');
  if (p.startsWith('/auth/') || p === '/auth-proxy/config'
    || p === '/auth-proxy' || p.startsWith('/share/dashboard/')
    || p.startsWith('/share/query/') || p === '/health') return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string) || '';
  if (AUTH_TOKEN && token === AUTH_TOKEN) {
    req.user = { _id: 'legacy-auth-token', login: 'legacy-admin', role: 'admin' };
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    if (!payload?._id || !payload?.login || !payload?.role) throw new Error('Invalid token');
    const current = await users.findOneAsync({ _id: payload._id });
    if (!current) throw new Error('User no longer exists');
    req.user = { _id: current._id, login: current.login, role: current.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  };
}
