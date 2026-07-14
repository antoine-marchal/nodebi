import crypto from 'crypto';
import { SHARE_SECRET } from './config';

interface Payload {
  id: string;
  exp?: number; // unix seconds
}

function b64(s: string | Buffer): string {
  return Buffer.from(s).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', SHARE_SECRET).update(payload).digest('base64url');
}

export function createToken(p: Payload): string {
  const body = b64(JSON.stringify(p));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyToken(token: string): Payload | null {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, sig] = token.split('.');
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig || '');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as Payload;
    if (p.exp && Date.now() / 1000 > p.exp) return null;
    return p;
  } catch { return null; }
}
