"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareRouter = shareRouter;
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const nedb_adapter_1 = require("../db/nedb-adapter");
const mongo_adapter_1 = require("../db/mongo-adapter");
const share_1 = require("../share");
const secrets_1 = require("../secrets");
const config_1 = require("../config");
const permissions_1 = require("../permissions");
function safeError(e) {
    return config_1.PROD ? 'Query failed' : String(e?.message || e);
}
function shareRouter(db, namespaces) {
    const router = (0, express_1.Router)();
    // Create a signed token (caller must be already authenticated by parent middleware)
    router.post('/create/:id', async (req, res) => {
        const { ttlDays } = (req.body || {});
        const doc = await db.findOneAsync({ _id: req.params.id });
        if (!doc)
            return res.status(404).json({ error: 'Not found' });
        if (!req.user || !(0, permissions_1.canEditDashboard)(req.user, doc))
            return res.status(403).json({ error: 'You can only share your own dashboards' });
        const namespace = (doc.namespaceId && doc.namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID)
            ? await namespaces.findOneAsync({ _id: doc.namespaceId }) : null;
        if (doc.namespaceId && doc.namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID && !namespace)
            return res.status(409).json({ error: 'Dashboard namespace no longer exists' });
        if (!(0, permissions_1.canAccessNamespace)(req.user, namespace))
            return res.status(403).json({ error: 'No access to this namespace' });
        const payload = { id: req.params.id };
        if (ttlDays && ttlDays > 0)
            payload.exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
        res.json({ token: (0, share_1.createToken)(payload) });
    });
    // Public — verify token, return stripped dashboard
    router.get('/dashboard/:token', async (req, res) => {
        const p = (0, share_1.verifyToken)(req.params.token);
        if (!p)
            return res.status(403).json({ error: 'Invalid or expired token' });
        const doc = await db.findOneAsync({ _id: p.id });
        if (!doc)
            return res.status(404).json({ error: 'Not found' });
        res.json((0, secrets_1.stripSecrets)(doc));
    });
    // Public — proxy query for a specific dashboard's data sources only
    router.post('/query/:token', async (req, res) => {
        const p = (0, share_1.verifyToken)(req.params.token);
        if (!p)
            return res.status(403).json({ error: 'Invalid or expired token' });
        const doc = await db.findOneAsync({ _id: p.id });
        if (!doc)
            return res.status(404).json({ error: 'Not found' });
        const { dataSourceId, collection, queryFilter, pipeline, limit } = req.body;
        const dsRef = (doc.dataSources || []).find((d) => d.id === dataSourceId);
        if (!dsRef)
            return res.status(404).json({ error: 'Data source not found in this dashboard' });
        const ds = (0, secrets_1.hydrate)(dsRef);
        let adapter;
        try {
            if (ds.type === 'nedb') {
                const base = path_1.default.resolve(ds.nedbPath
                    ? path_1.default.isAbsolute(ds.nedbPath) ? ds.nedbPath : path_1.default.join(config_1.USER_DATA_DIR, ds.nedbPath)
                    : config_1.USER_DATA_DIR);
                const root = path_1.default.resolve(config_1.USER_DATA_DIR);
                if (!base.startsWith(root))
                    throw new Error('Forbidden');
                adapter = new nedb_adapter_1.NedbAdapter(base);
            }
            else {
                if (!ds.mongoUri || !ds.mongoDatabase)
                    throw new Error('MongoDB requires uri and database');
                adapter = new mongo_adapter_1.MongoAdapter(ds.mongoUri, ds.mongoDatabase);
            }
            await adapter.connect();
            const rows = pipeline?.length
                ? await adapter.aggregate({ collection, pipeline })
                : await adapter.find({ collection, query: queryFilter || {}, limit: Math.min(limit ?? config_1.MAX_RESPONSE_ROWS, config_1.MAX_RESPONSE_ROWS) });
            res.json(rows.length > config_1.MAX_RESPONSE_ROWS ? rows.slice(0, config_1.MAX_RESPONSE_ROWS) : rows);
        }
        catch (e) {
            res.status(500).json({ error: safeError(e) });
        }
        finally {
            adapter?.disconnect().catch(() => { });
        }
    });
    return router;
}
