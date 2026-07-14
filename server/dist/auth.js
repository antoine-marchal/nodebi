"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccessToken = createAccessToken;
exports.requireRole = requireRole;
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
function createAccessToken(user) {
    return jsonwebtoken_1.default.sign({ _id: user._id, login: user.login, role: user.role }, config_1.JWT_SECRET, { expiresIn: '8h' });
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (req.user.role === 'admin' || roles.includes(req.user.role))
            return next();
        return res.status(403).json({ error: 'Forbidden' });
    };
}
function authMiddleware(users) {
    return async (req, res, next) => {
        const p = req.path.replace(/^\/api/, '');
        if (p.startsWith('/auth/') || p === '/auth-proxy/config'
            || p === '/auth-proxy' || p.startsWith('/share/dashboard/')
            || p.startsWith('/share/query/') || p === '/health')
            return next();
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token || '';
        if (config_1.AUTH_TOKEN && token === config_1.AUTH_TOKEN) {
            req.user = { _id: 'legacy-auth-token', login: 'legacy-admin', role: 'admin' };
            return next();
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
            if (!payload?._id || !payload?.login || !payload?.role)
                throw new Error('Invalid token');
            const current = await users.findOneAsync({ _id: payload._id });
            if (!current)
                throw new Error('User no longer exists');
            req.user = { _id: current._id, login: current.login, role: current.role };
            return next();
        }
        catch {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    };
}
