"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdmin = ensureAdmin;
exports.authRouter = authRouter;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const uuid_1 = require("uuid");
const auth_1 = require("../auth");
const config_1 = require("../config");
const ROLES = ['admin', 'operator', 'viewer'];
const publicUser = (u) => ({ _id: u._id, login: u.login, role: u.role, createdAt: u.createdAt });
async function ensureAdmin(users) {
    if (await users.findOneAsync({ login: config_1.ADMIN_LOGIN }))
        return;
    const now = new Date().toISOString();
    await users.insertAsync({ _id: (0, uuid_1.v4)(), login: config_1.ADMIN_LOGIN, passwordHash: await bcryptjs_1.default.hash(config_1.ADMIN_PASSWORD, 12), role: 'admin', createdAt: now, updatedAt: now });
    console.log(`Created initial NodeBI admin user '${config_1.ADMIN_LOGIN}'.`);
}
function requestText(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https_1.default : http_1.default;
        client.get(url, response => { let data = ''; response.on('data', c => data += c); response.on('end', () => resolve(data)); }).on('error', reject);
    });
}
function authRouter(users) {
    const router = (0, express_1.Router)();
    router.post('/auth/login', async (req, res) => {
        const login = String(req.body?.login || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const user = await users.findOneAsync({ login });
        if (!user?.passwordHash || !(await bcryptjs_1.default.compare(password, user.passwordHash)))
            return res.status(401).json({ error: 'Invalid credentials' });
        res.json({ accessToken: (0, auth_1.createAccessToken)(user), user: publicUser(user) });
    });
    router.get('/auth/me', async (req, res) => {
        const user = req.user && await users.findOneAsync({ _id: req.user._id });
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        res.json(publicUser(user));
    });
    router.get('/auth-proxy/config', (_req, res) => res.json({
        enabled: !!(config_1.PROXYAUTH_URL && config_1.PROXYAUTH_REGEX), paramName: config_1.PROXYAUTH_NAME,
        loginUrl: config_1.PROXYAUTH_LOGIN_URL || undefined, service: config_1.PUBLIC_URL,
    }));
    router.get('/auth-proxy', async (req, res) => {
        if (!config_1.PROXYAUTH_URL || !config_1.PROXYAUTH_REGEX)
            return res.status(503).json({ error: 'Proxy authentication is not configured' });
        const ticket = String(req.query[config_1.PROXYAUTH_NAME] || '');
        if (!ticket)
            return res.status(400).json({ error: `Missing query parameter: ${config_1.PROXYAUTH_NAME}` });
        try {
            const separator = config_1.PROXYAUTH_URL.includes('?') ? '&' : '?';
            const body = await requestText(`${config_1.PROXYAUTH_URL}${separator}${encodeURIComponent(config_1.PROXYAUTH_NAME)}=${encodeURIComponent(ticket)}&service=${encodeURIComponent(config_1.PUBLIC_URL)}`);
            const match = body.match(new RegExp(config_1.PROXYAUTH_REGEX));
            const login = match?.[1]?.trim().toLowerCase();
            const user = login ? await users.findOneAsync({ login }) : null;
            if (!user)
                return res.status(401).json({ error: 'Proxy-authenticated user is not registered in NodeBI' });
            res.json({ accessToken: (0, auth_1.createAccessToken)(user), user: publicUser(user) });
        }
        catch (e) {
            res.status(502).json({ error: e?.message || 'Proxy authentication failed' });
        }
    });
    router.get('/users', (0, auth_1.requireRole)('admin'), async (_req, res) => res.json((await users.findAsync({})).map(publicUser)));
    router.post('/users', (0, auth_1.requireRole)('admin'), async (req, res) => {
        const login = String(req.body?.login || '').trim().toLowerCase();
        const password = req.body?.password ? String(req.body.password) : '';
        const role = req.body?.role;
        if (!login || !ROLES.includes(role))
            return res.status(400).json({ error: 'A login and valid role are required' });
        if (await users.findOneAsync({ login }))
            return res.status(409).json({ error: 'User already exists' });
        const now = new Date().toISOString();
        const user = { _id: (0, uuid_1.v4)(), login, passwordHash: password ? await bcryptjs_1.default.hash(password, 12) : null, role, createdAt: now, updatedAt: now };
        await users.insertAsync(user);
        res.status(201).json(publicUser(user));
    });
    router.patch('/users/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
        const target = await users.findOneAsync({ _id: req.params.id });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        const role = req.body?.role;
        const password = req.body?.password ? String(req.body.password) : undefined;
        if (role && !ROLES.includes(role))
            return res.status(400).json({ error: 'Invalid role' });
        if (target.role === 'admin' && role && role !== 'admin' && await users.countAsync({ role: 'admin' }) <= 1)
            return res.status(400).json({ error: 'Cannot demote the last admin' });
        const patch = { updatedAt: new Date().toISOString() };
        if (role)
            patch.role = role;
        if (password)
            patch.passwordHash = await bcryptjs_1.default.hash(password, 12);
        await users.updateAsync({ _id: target._id }, { $set: patch }, {});
        res.json(publicUser((await users.findOneAsync({ _id: target._id }))));
    });
    router.delete('/users/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
        const target = await users.findOneAsync({ _id: req.params.id });
        if (!target)
            return res.status(404).json({ error: 'User not found' });
        if (target.role === 'admin' && await users.countAsync({ role: 'admin' }) <= 1)
            return res.status(400).json({ error: 'Cannot delete the last admin' });
        await users.removeAsync({ _id: target._id }, {});
        res.json({ success: true });
    });
    return router;
}
