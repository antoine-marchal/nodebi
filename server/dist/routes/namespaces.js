"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.namespacesRouter = namespacesRouter;
const express_1 = require("express");
const uuid_1 = require("uuid");
const auth_1 = require("../auth");
const permissions_1 = require("../permissions");
const validRoles = ['admin', 'operator', 'viewer'];
const normalize = (body) => ({
    name: String(body?.name || '').trim(), description: String(body?.description || ''),
    allowedRoles: Array.isArray(body?.allowedRoles) ? body.allowedRoles.filter((r) => validRoles.includes(r)) : [],
    allowedUserIds: Array.isArray(body?.allowedUserIds) ? body.allowedUserIds.map(String) : [],
});
function namespacesRouter(db, dashboards) {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        const docs = await db.findAsync({});
        res.json(docs.filter(ns => req.user && (0, permissions_1.canAccessNamespace)(req.user, ns)));
    });
    router.post('/', (0, auth_1.requireRole)('admin'), async (req, res) => {
        const data = normalize(req.body);
        if (!data.name)
            return res.status(400).json({ error: 'Name is required' });
        const now = new Date().toISOString();
        const doc = { _id: (0, uuid_1.v4)(), ...data, createdAt: now, updatedAt: now };
        await db.insertAsync(doc);
        res.status(201).json(doc);
    });
    router.put('/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
        if (req.params.id === permissions_1.DEFAULT_NAMESPACE_ID)
            return res.status(400).json({ error: 'The default namespace cannot be changed' });
        const data = normalize(req.body);
        if (!data.name)
            return res.status(400).json({ error: 'Name is required' });
        const result = await db.updateAsync({ _id: req.params.id }, { $set: { ...data, updatedAt: new Date().toISOString() } }, {});
        const count = typeof result === 'number' ? result : result.numAffected ?? 0;
        if (!count)
            return res.status(404).json({ error: 'Namespace not found' });
        res.json(await db.findOneAsync({ _id: req.params.id }));
    });
    router.delete('/:id', (0, auth_1.requireRole)('admin'), async (req, res) => {
        if (req.params.id === permissions_1.DEFAULT_NAMESPACE_ID)
            return res.status(400).json({ error: 'The default namespace cannot be deleted' });
        if (await dashboards.countAsync({ namespaceId: req.params.id }))
            return res.status(409).json({ error: 'Move or delete dashboards in this namespace first' });
        const count = await db.removeAsync({ _id: req.params.id }, {});
        if (!count)
            return res.status(404).json({ error: 'Namespace not found' });
        res.json({ success: true });
    });
    return router;
}
