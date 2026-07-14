import path from 'path';
import dotenv from 'dotenv';
// npm --prefix runs server scripts with server/ as cwd; always load the project-level file first.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config();

export const PORT = Number(process.env.PORT) || 3001;
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
export const USER_DATA_DIR = path.join(DATA_DIR, 'user');
export const SECRETS_DIR = path.join(DATA_DIR, 'secrets');
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
export const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
export const JWT_SECRET = process.env.JWT_SECRET || 'nodebi-development-jwt-secret';
export const ADMIN_LOGIN = (process.env.ADMIN_LOGIN || 'admin').toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
export const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
export const PROXYAUTH_NAME = process.env.NODEBI_PROXYAUTH_NAME || 'ticket';
export const PROXYAUTH_URL = process.env.NODEBI_PROXYAUTH_URL || '';
export const PROXYAUTH_LOGIN_URL = process.env.NODEBI_PROXYAUTH_LOGIN_URL
  || PROXYAUTH_URL.replace(/\/validate\/?$/i, '/login');
export const PROXYAUTH_REGEX = process.env.NODEBI_PROXYAUTH_REGEX || '';
export const SHARE_SECRET = process.env.SHARE_SECRET || 'change-me-share-secret';
export const ENABLE_SEED = process.env.ENABLE_SEED === 'true';
export const MAX_RESPONSE_ROWS = Number(process.env.MAX_RESPONSE_ROWS) || 10000;
export const PROD = process.env.NODE_ENV === 'production';
export const CLIENT_DIST = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.join(__dirname, '..', '..', 'client', 'dist');

if (PROD) {
  const unsafe = [
    !process.env.JWT_SECRET || ['nodebi-development-jwt-secret', 'replace-with-at-least-32-random-bytes'].includes(JWT_SECRET) ? 'JWT_SECRET' : '',
    !process.env.ADMIN_PASSWORD || ['admin', 'change-this-on-first-start'].includes(ADMIN_PASSWORD) ? 'ADMIN_PASSWORD' : '',
    !process.env.SHARE_SECRET || ['change-me-share-secret', 'replace-with-32-byte-random'].includes(SHARE_SECRET) ? 'SHARE_SECRET' : '',
  ].filter(Boolean);
  if (unsafe.length) throw new Error(`Refusing to start in production with unsafe configuration: ${unsafe.join(', ')}`);
}
