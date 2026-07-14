"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardsRouter = dashboardsRouter;
const express_1 = require("express");
const nedb_1 = __importDefault(require("@seald-io/nedb"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const secrets_1 = require("../secrets");
const permissions_1 = require("../permissions");
const MAX_REVISIONS = 20;
function dashboardsRouter(dataDir, db, namespaces) {
    const router = (0, express_1.Router)();
    const revs = new nedb_1.default({ filename: path_1.default.join(dataDir, 'revisions.db'), autoload: true });
    async function namespaceFor(dashboard) {
        const id = dashboard.namespaceId || permissions_1.DEFAULT_NAMESPACE_ID;
        return id === permissions_1.DEFAULT_NAMESPACE_ID ? null : namespaces.findOneAsync({ _id: id });
    }
    async function canView(req, dashboard) {
        const namespace = await namespaceFor(dashboard);
        if ((dashboard.namespaceId || permissions_1.DEFAULT_NAMESPACE_ID) !== permissions_1.DEFAULT_NAMESPACE_ID && !namespace)
            return false;
        return !!req.user && (0, permissions_1.canAccessNamespace)(req.user, namespace);
    }
    async function recordRevision(snapshot) {
        if (!snapshot._id)
            return;
        await revs.insertAsync({ _id: (0, uuid_1.v4)(), dashboardId: snapshot._id, snapshot, createdAt: new Date().toISOString() });
        const all = await revs.findAsync({ dashboardId: snapshot._id });
        all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        for (const revision of all.slice(MAX_REVISIONS))
            await revs.removeAsync({ _id: revision._id }, {});
    }
    router.get('/', async (req, res) => {
        try {
            const visible = [];
            for (const doc of await db.findAsync({}))
                if (await canView(req, doc))
                    visible.push((0, secrets_1.stripSecrets)(doc));
            res.json(visible);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const doc = await db.findOneAsync({ _id: req.params.id });
            if (!doc)
                return res.status(404).json({ error: 'Not found' });
            if (!(await canView(req, doc)))
                return res.status(403).json({ error: 'Forbidden' });
            res.json((0, secrets_1.stripSecrets)(doc));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/', async (req, res) => {
        try {
            if (!req.user || !['admin', 'operator'].includes(req.user.role))
                return res.status(403).json({ error: 'Only admins and operators can create dashboards' });
            const namespaceId = String(req.body?.namespaceId || permissions_1.DEFAULT_NAMESPACE_ID);
            const namespace = namespaceId === permissions_1.DEFAULT_NAMESPACE_ID ? null : await namespaces.findOneAsync({ _id: namespaceId });
            if (namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID && !namespace)
                return res.status(400).json({ error: 'Namespace not found' });
            if (!(0, permissions_1.canAccessNamespace)(req.user, namespace))
                return res.status(403).json({ error: 'No access to this namespace' });
            const cleaned = (0, secrets_1.extractAndPersist)({ ...req.body, _id: (0, uuid_1.v4)() });
            const now = new Date().toISOString();
            const dashboard = { ...cleaned, namespaceId, ownerId: req.user._id, ownerLogin: req.user.login, createdAt: now, updatedAt: now };
            const doc = await db.insertAsync(dashboard);
            await recordRevision(doc);
            res.status(201).json((0, secrets_1.stripSecrets)(doc));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.put('/:id', async (req, res) => {
        try {
            const existing = await db.findOneAsync({ _id: req.params.id });
            if (!existing)
                return res.status(404).json({ error: 'Not found' });
            if (!req.user || !(0, permissions_1.canEditDashboard)(req.user, existing))
                return res.status(403).json({ error: 'You can only edit your own dashboards' });
            const namespaceId = String(req.body?.namespaceId || existing.namespaceId || permissions_1.DEFAULT_NAMESPACE_ID);
            const namespace = namespaceId === permissions_1.DEFAULT_NAMESPACE_ID ? null : await namespaces.findOneAsync({ _id: namespaceId });
            if (namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID && !namespace)
                return res.status(400).json({ error: 'Namespace not found' });
            if (!(0, permissions_1.canAccessNamespace)(req.user, namespace))
                return res.status(403).json({ error: 'No access to this namespace' });
            const cleaned = (0, secrets_1.extractAndPersist)({ ...req.body, _id: req.params.id });
            const update = { ...cleaned, namespaceId, ownerId: existing.ownerId, ownerLogin: existing.ownerLogin, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
            delete update._id;
            await db.updateAsync({ _id: req.params.id }, { $set: update }, {});
            const doc = (await db.findOneAsync({ _id: req.params.id }));
            await recordRevision(doc);
            res.json((0, secrets_1.stripSecrets)(doc));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.delete('/:id', async (req, res) => {
        try {
            const doc = await db.findOneAsync({ _id: req.params.id });
            if (!doc)
                return res.status(404).json({ error: 'Not found' });
            if (!req.user || !(0, permissions_1.canEditDashboard)(req.user, doc))
                return res.status(403).json({ error: 'You can only delete your own dashboards' });
            for (const ds of doc.dataSources || [])
                if (ds.type === 'mongodb')
                    (0, secrets_1.removeDataSourceSecret)(ds.id);
            await db.removeAsync({ _id: req.params.id }, {});
            await revs.removeAsync({ dashboardId: req.params.id }, { multi: true });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/:id/revisions', async (req, res) => {
        const doc = await db.findOneAsync({ _id: req.params.id });
        if (!doc)
            return res.status(404).json({ error: 'Not found' });
        if (!(await canView(req, doc)))
            return res.status(403).json({ error: 'Forbidden' });
        const all = await revs.findAsync({ dashboardId: req.params.id });
        all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        res.json(all.map((r) => ({ _id: r._id, createdAt: r.createdAt })));
    });
    router.post('/:id/revisions/:revId/restore', async (req, res) => {
        const current = await db.findOneAsync({ _id: req.params.id });
        if (!current)
            return res.status(404).json({ error: 'Not found' });
        if (!req.user || !(0, permissions_1.canEditDashboard)(req.user, current))
            return res.status(403).json({ error: 'You can only restore your own dashboards' });
        const rev = await revs.findOneAsync({ _id: req.params.revId, dashboardId: req.params.id });
        if (!rev)
            return res.status(404).json({ error: 'Revision not found' });
        const update = { ...rev.snapshot, _id: undefined, ownerId: current.ownerId, ownerLogin: current.ownerLogin, updatedAt: new Date().toISOString() };
        delete update._id;
        await db.updateAsync({ _id: req.params.id }, { $set: update }, {});
        const doc = (await db.findOneAsync({ _id: req.params.id }));
        await recordRevision(doc);
        res.json((0, secrets_1.stripSecrets)(doc));
    });
    return router;
}
