"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NedbAdapter = void 0;
const nedb_1 = __importDefault(require("@seald-io/nedb"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const KNOWN_STAGES = new Set(['$match', '$group', '$sort', '$limit', '$skip', '$project', '$count']);
class NedbAdapter {
    constructor(basePath) {
        this.stores = new Map();
        this.basePath = basePath;
        if (!fs_1.default.existsSync(basePath))
            fs_1.default.mkdirSync(basePath, { recursive: true });
    }
    async connect() { return; }
    async disconnect() {
        for (const ds of this.stores.values()) {
            try {
                await ds.compactDatafileAsync();
            }
            catch { /* best-effort compaction */ }
        }
        this.stores.clear();
    }
    getStore(collection) {
        if (!this.stores.has(collection)) {
            const ds = new nedb_1.default({
                filename: path_1.default.join(this.basePath, `${collection}.db`),
                autoload: true,
            });
            this.stores.set(collection, ds);
        }
        return this.stores.get(collection);
    }
    async find(opts) {
        const db = this.getStore(opts.collection);
        let cursor = db.find(opts.query || {});
        if (opts.skip)
            cursor = cursor.skip(opts.skip);
        if (opts.limit)
            cursor = cursor.limit(opts.limit);
        return cursor.execAsync();
    }
    async aggregate(opts) {
        const stages = opts.pipeline;
        for (const stage of stages) {
            const keys = Object.keys(stage);
            for (const k of keys) {
                if (!KNOWN_STAGES.has(k))
                    throw new Error(`Unsupported pipeline stage: ${k}`);
            }
        }
        // First $match can be delegated to NeDB for index/operator support
        let docs;
        if (stages[0]?.$match) {
            docs = await this.find({ collection: opts.collection, query: stages[0].$match });
            stages.shift();
        }
        else {
            docs = await this.find({ collection: opts.collection });
        }
        for (const stage of stages) {
            docs = this.applyStage(docs, stage);
        }
        return docs;
    }
    applyStage(docs, stage) {
        if (stage.$match)
            return docs.filter(d => matchesQuery(d, stage.$match));
        if (stage.$group)
            return this.applyGroup(docs, stage.$group);
        if (stage.$sort) {
            const entries = Object.entries(stage.$sort);
            return [...docs].sort((a, b) => {
                for (const [k, dir] of entries) {
                    const av = a[k], bv = b[k];
                    if (av < bv)
                        return -dir;
                    if (av > bv)
                        return dir;
                }
                return 0;
            });
        }
        if (stage.$limit)
            return docs.slice(0, stage.$limit);
        if (stage.$skip)
            return docs.slice(stage.$skip);
        if (stage.$count) {
            const field = String(stage.$count);
            return [{ [field]: docs.length }];
        }
        if (stage.$project) {
            const spec = stage.$project;
            const include = Object.entries(spec).filter(([_, v]) => v === 1).map(([k]) => k);
            const exclude = Object.entries(spec).filter(([_, v]) => v === 0).map(([k]) => k);
            return docs.map(d => {
                if (include.length) {
                    const out = {};
                    for (const k of include)
                        out[k] = d[k];
                    if (!('_id' in spec) || spec._id !== 0)
                        out._id = d._id;
                    return out;
                }
                const out = { ...d };
                for (const k of exclude)
                    delete out[k];
                return out;
            });
        }
        return docs;
    }
    applyGroup(docs, spec) {
        const groups = new Map();
        for (const doc of docs) {
            const keyVal = spec._id !== null && spec._id !== undefined ? resolve(doc, spec._id) : null;
            const keyStr = JSON.stringify(keyVal ?? null);
            if (!groups.has(keyStr))
                groups.set(keyStr, { key: keyVal, docs: [] });
            groups.get(keyStr).docs.push(doc);
        }
        return Array.from(groups.values()).map(({ key, docs: group }) => {
            const row = { _id: key };
            for (const [field, acc] of Object.entries(spec)) {
                if (field === '_id')
                    continue;
                row[field] = accumulate(group, acc);
            }
            return row;
        });
    }
    async listCollections() {
        try {
            return fs_1.default.readdirSync(this.basePath)
                .filter(f => f.endsWith('.db') && !f.startsWith('_'))
                .map(f => f.replace('.db', ''));
        }
        catch {
            return [];
        }
    }
}
exports.NedbAdapter = NedbAdapter;
function resolve(doc, expr) {
    if (typeof expr === 'string' && expr.startsWith('$')) {
        return expr.slice(1).split('.').reduce((o, k) => o?.[k], doc);
    }
    return expr;
}
function numericValues(docs, expr) {
    const out = [];
    for (const d of docs) {
        const v = resolve(d, expr);
        if (v === null || v === undefined)
            continue;
        const n = Number(v);
        if (Number.isNaN(n))
            continue;
        out.push(n);
    }
    return out;
}
function accumulate(docs, acc) {
    if (acc.$sum !== undefined) {
        if (acc.$sum === 1)
            return docs.length;
        return numericValues(docs, acc.$sum).reduce((s, v) => s + v, 0);
    }
    if (acc.$avg !== undefined) {
        const vals = numericValues(docs, acc.$avg);
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    if (acc.$min !== undefined) {
        const vals = numericValues(docs, acc.$min);
        return vals.length ? Math.min(...vals) : null;
    }
    if (acc.$max !== undefined) {
        const vals = numericValues(docs, acc.$max);
        return vals.length ? Math.max(...vals) : null;
    }
    if (acc.$count !== undefined)
        return docs.length;
    if (acc.$first !== undefined)
        return docs.length ? resolve(docs[0], acc.$first) : null;
    if (acc.$last !== undefined)
        return docs.length ? resolve(docs[docs.length - 1], acc.$last) : null;
    return null;
}
// Lightweight $match evaluator for use AFTER group stage (when delegation to NeDB isn't possible)
function matchesQuery(doc, query) {
    for (const [k, v] of Object.entries(query)) {
        if (k === '$and')
            return v.every(q => matchesQuery(doc, q));
        if (k === '$or')
            return v.some(q => matchesQuery(doc, q));
        const fieldVal = k.split('.').reduce((o, key) => o?.[key], doc);
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            for (const [op, opv] of Object.entries(v)) {
                if (op === '$eq' && fieldVal !== opv)
                    return false;
                if (op === '$ne' && fieldVal === opv)
                    return false;
                if (op === '$gt' && !(fieldVal > opv))
                    return false;
                if (op === '$gte' && !(fieldVal >= opv))
                    return false;
                if (op === '$lt' && !(fieldVal < opv))
                    return false;
                if (op === '$lte' && !(fieldVal <= opv))
                    return false;
                if (op === '$in' && !opv.includes(fieldVal))
                    return false;
                if (op === '$nin' && opv.includes(fieldVal))
                    return false;
                if (op === '$regex' && !new RegExp(opv).test(String(fieldVal ?? '')))
                    return false;
            }
        }
        else if (fieldVal !== v)
            return false;
    }
    return true;
}
