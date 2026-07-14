import { describe, expect, it } from 'vitest';
import { canAccessNamespace, canEditDashboard } from './permissions';
import { AuthUser } from './auth';
import { Namespace } from './types';

const admin: AuthUser = { _id: 'a', login: 'admin', role: 'admin' };
const operator: AuthUser = { _id: 'o', login: 'operator', role: 'operator' };
const viewer: AuthUser = { _id: 'v', login: 'viewer', role: 'viewer' };
const namespace: Namespace = { _id: 'private', name: 'Private', allowedRoles: ['viewer'], allowedUserIds: [], createdAt: '', updatedAt: '' };

describe('RBAC permissions', () => {
  it('always lets admins access namespaces', () => expect(canAccessNamespace(admin, namespace)).toBe(true));
  it('allows namespace access by role or explicit user', () => {
    expect(canAccessNamespace(viewer, namespace)).toBe(true);
    expect(canAccessNamespace(operator, namespace)).toBe(false);
    expect(canAccessNamespace(operator, { ...namespace, allowedUserIds: ['o'] })).toBe(true);
  });
  it('only lets operators edit dashboards they own', () => {
    expect(canEditDashboard(admin, { name: 'x', dataSources: [], widgets: [], layout: [] })).toBe(true);
    expect(canEditDashboard(operator, { name: 'x', ownerId: 'o', dataSources: [], widgets: [], layout: [] })).toBe(true);
    expect(canEditDashboard(operator, { name: 'x', ownerId: 'someone-else', dataSources: [], widgets: [], layout: [] })).toBe(false);
    expect(canEditDashboard(viewer, { name: 'x', ownerId: 'v', dataSources: [], widgets: [], layout: [] })).toBe(false);
  });
});
