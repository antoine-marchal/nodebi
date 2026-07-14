import { AuthUser } from './auth';
import { Dashboard, Namespace } from './types';

export const DEFAULT_NAMESPACE_ID = 'default';

export function canAccessNamespace(user: AuthUser, namespace?: Namespace | null): boolean {
  if (user.role === 'admin') return true;
  if (!namespace || namespace._id === DEFAULT_NAMESPACE_ID) return true;
  return namespace.allowedRoles.includes(user.role) || namespace.allowedUserIds.includes(user._id);
}

export function canEditDashboard(user: AuthUser, dashboard: Dashboard): boolean {
  return user.role === 'admin' || (user.role === 'operator' && dashboard.ownerId === user._id);
}
