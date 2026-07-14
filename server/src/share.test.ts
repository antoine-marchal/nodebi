import { describe, it, expect } from 'vitest';
import { createToken, verifyToken } from './share';

describe('share tokens', () => {
  it('round-trips payload', () => {
    const t = createToken({ id: 'abc' });
    expect(verifyToken(t)?.id).toBe('abc');
  });

  it('rejects tampered token', () => {
    const t = createToken({ id: 'abc' });
    expect(verifyToken(t + 'x')).toBeNull();
  });

  it('rejects expired token', () => {
    const t = createToken({ id: 'abc', exp: Math.floor(Date.now() / 1000) - 1 });
    expect(verifyToken(t)).toBeNull();
  });
});
