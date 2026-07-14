"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NAMESPACE_ID = void 0;
exports.canAccessNamespace = canAccessNamespace;
exports.canEditDashboard = canEditDashboard;
exports.DEFAULT_NAMESPACE_ID = 'default';
function canAccessNamespace(user, namespace) {
    if (user.role === 'admin')
        return true;
    if (!namespace || namespace._id === exports.DEFAULT_NAMESPACE_ID)
        return true;
    return namespace.allowedRoles.includes(user.role) || namespace.allowedUserIds.includes(user._id);
}
function canEditDashboard(user, dashboard) {
    return user.role === 'admin' || (user.role === 'operator' && dashboard.ownerId === user._id);
}
