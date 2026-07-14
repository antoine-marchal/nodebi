import { AuthUser } from './auth';
import { Dashboard, Namespace } from './types';
export declare const DEFAULT_NAMESPACE_ID = "default";
export declare function canAccessNamespace(user: AuthUser, namespace?: Namespace | null): boolean;
export declare function canEditDashboard(user: AuthUser, dashboard: Dashboard): boolean;
