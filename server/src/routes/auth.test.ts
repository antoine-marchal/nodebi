import Nedb from '@seald-io/nedb';
import { describe, expect, it } from 'vitest';
import { findOrCreateProxyUser } from './auth';
import { User } from '../types';

describe('findOrCreateProxyUser', () => {
  it('creates an unknown proxy user without a password and with the viewer role', async () => {
    const users = new Nedb<User>({ inMemoryOnly: true });

    const user = await findOrCreateProxyUser(users, 'proxy.user');

    expect(user).toMatchObject({ login: 'proxy.user', passwordHash: null, role: 'viewer' });
    expect(await users.countAsync({ login: 'proxy.user' })).toBe(1);
  });

  it('keeps the role and password of an existing user', async () => {
    const users = new Nedb<User>({ inMemoryOnly: true });
    const existing = await users.insertAsync({
      _id: 'existing-user', login: 'operator.user', passwordHash: 'hash', role: 'operator',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const user = await findOrCreateProxyUser(users, existing.login);

    expect(user).toEqual(existing);
    expect(await users.countAsync({ login: existing.login })).toBe(1);
  });
});
