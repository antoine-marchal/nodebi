"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoAdapter = void 0;
exports.closeMongoPool = closeMongoPool;
const mongodb_1 = require("mongodb");
const pool = new Map();
function getClient(uri) {
    const cached = pool.get(uri);
    if (cached)
        return cached;
    const p = new mongodb_1.MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
    pool.set(uri, p);
    p.catch(() => pool.delete(uri));
    return p;
}
async function closeMongoPool() {
    for (const p of pool.values()) {
        try {
            (await p).close();
        }
        catch { /* best-effort shutdown */ }
    }
    pool.clear();
}
class MongoAdapter {
    constructor(uri, dbName) {
        this.db = null;
        this.uri = uri;
        this.dbName = dbName;
    }
    async connect() {
        const client = await getClient(this.uri);
        this.db = client.db(this.dbName);
    }
    async disconnect() {
        this.db = null;
    }
    col(name) {
        if (!this.db)
            throw new Error('Not connected to MongoDB');
        return this.db.collection(name);
    }
    async find(opts) {
        let cursor = this.col(opts.collection).find(opts.query || {});
        if (opts.skip)
            cursor = cursor.skip(opts.skip);
        if (opts.limit)
            cursor = cursor.limit(opts.limit);
        return cursor.toArray();
    }
    async aggregate(opts) {
        return this.col(opts.collection).aggregate(opts.pipeline).toArray();
    }
    async listCollections() {
        if (!this.db)
            return [];
        const cols = await this.db.listCollections().toArray();
        return cols.map(c => c.name);
    }
}
exports.MongoAdapter = MongoAdapter;
