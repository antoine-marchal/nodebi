"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryRouter = queryRouter;
const express_1 = require("express");
const nedb_adapter_1 = require("../db/nedb-adapter");
const mongo_adapter_1 = require("../db/mongo-adapter");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const secrets_1 = require("../secrets");
const permissions_1 = require("../permissions");
function safeError(e) {
    const msg = String(e?.message || e || 'Error');
    return config_1.PROD ? msg.replace(/\b\/[^\s]+/g, '<path>').slice(0, 250) : msg;
}
function safeNedbPath(input) {
    if (!input)
        return config_1.USER_DATA_DIR;
    const candidate = path_1.default.isAbsolute(input) ? input : path_1.default.join(config_1.USER_DATA_DIR, input);
    const resolved = path_1.default.resolve(candidate);
    const root = path_1.default.resolve(config_1.USER_DATA_DIR);
    if (!resolved.startsWith(root + path_1.default.sep) && resolved !== root) {
        throw new Error('nedbPath outside allowed directory');
    }
    return resolved;
}
function queryRouter(dashboards, namespaces) {
    const router = (0, express_1.Router)();
    async function resolveDataSource(req) {
        const dashboardId = req.body?.dashboardId;
        const dataSourceId = req.body?.dataSourceId;
        if (!dashboardId) {
            if (!req.user || req.user.role === 'viewer')
                throw new Error('FORBIDDEN');
            return req.body.dataSource;
        }
        const dashboard = await dashboards.findOneAsync({ _id: dashboardId });
        if (!dashboard)
            throw new Error('DASHBOARD_NOT_FOUND');
        const namespace = dashboard.namespaceId && dashboard.namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID
            ? await namespaces.findOneAsync({ _id: dashboard.namespaceId }) : null;
        if (!req.user || (dashboard.namespaceId && dashboard.namespaceId !== permissions_1.DEFAULT_NAMESPACE_ID && !namespace)
            || !(0, permissions_1.canAccessNamespace)(req.user, namespace))
            throw new Error('FORBIDDEN');
        const source = dashboard.dataSources.find(item => item.id === dataSourceId);
        if (!source)
            throw new Error('DATASOURCE_NOT_FOUND');
        return source;
    }
    async function getAdapter(dsIn) {
        const ds = (0, secrets_1.hydrate)(dsIn);
        if (ds.type === 'nedb') {
            const basePath = safeNedbPath(ds.nedbPath);
            const adapter = new nedb_adapter_1.NedbAdapter(basePath);
            await adapter.connect();
            return adapter;
        }
        else {
            if (!ds.mongoUri || !ds.mongoDatabase)
                throw new Error('MongoDB requires uri and database');
            const adapter = new mongo_adapter_1.MongoAdapter(ds.mongoUri, ds.mongoDatabase);
            await adapter.connect();
            return adapter;
        }
    }
    function capRows(rows) {
        if (rows.length > config_1.MAX_RESPONSE_ROWS)
            return rows.slice(0, config_1.MAX_RESPONSE_ROWS);
        return rows;
    }
    router.post('/', async (req, res) => {
        const body = req.body;
        let adapter;
        try {
            adapter = await getAdapter(await resolveDataSource(req));
            let result;
            if (body.pipeline && body.pipeline.length > 0) {
                result = await adapter.aggregate({ collection: body.collection, pipeline: body.pipeline });
            }
            else {
                result = await adapter.find({
                    collection: body.collection,
                    query: body.queryFilter || {},
                    limit: Math.min(body.limit ?? config_1.MAX_RESPONSE_ROWS, config_1.MAX_RESPONSE_ROWS),
                });
            }
            res.json(capRows(result));
        }
        catch (e) {
            if (e.message === 'FORBIDDEN')
                return res.status(403).json({ error: 'Forbidden' });
            if (e.message?.endsWith('_NOT_FOUND'))
                return res.status(404).json({ error: 'Not found' });
            res.status(500).json({ error: safeError(e) });
        }
        finally {
            adapter?.disconnect().catch(() => { });
        }
    });
    router.post('/collections', async (req, res) => {
        let adapter;
        try {
            if (!req.user || req.user.role === 'viewer')
                return res.status(403).json({ error: 'Forbidden' });
            adapter = await getAdapter(req.body);
            const cols = await adapter.listCollections();
            res.json(cols);
        }
        catch (e) {
            res.status(500).json({ error: safeError(e) });
        }
        finally {
            adapter?.disconnect().catch(() => { });
        }
    });
    // Return one sample document to power field-autocomplete in the UI
    router.post('/sample', async (req, res) => {
        let adapter;
        try {
            if (!req.user || req.user.role === 'viewer')
                return res.status(403).json({ error: 'Forbidden' });
            const { dataSource, collection } = req.body;
            adapter = await getAdapter(dataSource);
            const rows = await adapter.find({ collection, limit: 1 });
            res.json(rows[0] || {});
        }
        catch (e) {
            res.status(500).json({ error: safeError(e) });
        }
        finally {
            adapter?.disconnect().catch(() => { });
        }
    });
    router.post('/seed', async (req, res) => {
        if (req.user?.role !== 'admin')
            return res.status(403).json({ error: 'Forbidden' });
        if (!config_1.ENABLE_SEED) {
            return res.status(403).json({ error: 'Seed disabled. Set ENABLE_SEED=true to enable.' });
        }
        try {
            const { collection, records } = req.body;
            if (!/^[a-zA-Z0-9_-]+$/.test(collection))
                throw new Error('Invalid collection name');
            const adapter = new nedb_adapter_1.NedbAdapter(config_1.USER_DATA_DIR);
            await adapter.connect();
            const db = adapter.getStore(collection);
            for (const rec of records)
                await db.insertAsync(rec);
            res.json({ inserted: records.length });
        }
        catch (e) {
            res.status(500).json({ error: safeError(e) });
        }
    });
    return router;
}
