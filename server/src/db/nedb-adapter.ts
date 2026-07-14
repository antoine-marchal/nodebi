import Nedb from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';
import { DbAdapter, FindOptions, AggregateOptions } from './interface';

const KNOWN_STAGES = new Set(['$match', '$group', '$sort', '$limit', '$skip', '$project', '$count']);

export class NedbAdapter implements DbAdapter {
  private basePath: string;
  private stores = new Map<string, Nedb>();

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  }

  async connect(): Promise<void> { return; }
  async disconnect(): Promise<void> {
    for (const ds of this.stores.values()) {
      try { await ds.compactDatafileAsync(); } catch { /* best-effort compaction */ }
    }
    this.stores.clear();
  }

  getStore(collection: string): Nedb {
    if (!this.stores.has(collection)) {
      const ds = new Nedb({
        filename: path.join(this.basePath, `${collection}.db`),
        autoload: true,
      });
      this.stores.set(collection, ds);
    }
    return this.stores.get(collection)!;
  }

  async find(opts: FindOptions): Promise<any[]> {
    const db = this.getStore(opts.collection);
    let cursor = db.find(opts.query || {});
    if (opts.skip) cursor = cursor.skip(opts.skip);
    if (opts.limit) cursor = cursor.limit(opts.limit);
    return (cursor.execAsync() as unknown) as Promise<any[]>;
  }

  async aggregate(opts: AggregateOptions): Promise<any[]> {
    const stages = opts.pipeline as Record<string, any>[];
    for (const stage of stages) {
      const keys = Object.keys(stage);
      for (const k of keys) {
        if (!KNOWN_STAGES.has(k)) throw new Error(`Unsupported pipeline stage: ${k}`);
      }
    }
    // First $match can be delegated to NeDB for index/operator support
    let docs: any[];
    if (stages[0]?.$match) {
      docs = await this.find({ collection: opts.collection, query: stages[0].$match });
      stages.shift();
    } else {
      docs = await this.find({ collection: opts.collection });
    }
    for (const stage of stages) {
      docs = this.applyStage(docs, stage);
    }
    return docs;
  }

  private applyStage(docs: any[], stage: Record<string, any>): any[] {
    if (stage.$match) return docs.filter(d => matchesQuery(d, stage.$match));
    if (stage.$group) return this.applyGroup(docs, stage.$group);
    if (stage.$sort) {
      const entries = Object.entries(stage.$sort) as [string, number][];
      return [...docs].sort((a, b) => {
        for (const [k, dir] of entries) {
          const av = a[k], bv = b[k];
          if (av < bv) return -dir;
          if (av > bv) return dir;
        }
        return 0;
      });
    }
    if (stage.$limit) return docs.slice(0, stage.$limit as number);
    if (stage.$skip) return docs.slice(stage.$skip as number);
    if (stage.$count) {
      const field = String(stage.$count);
      return [{ [field]: docs.length }];
    }
    if (stage.$project) {
      const spec = stage.$project as Record<string, 0 | 1>;
      const include = Object.entries(spec).filter(([_, v]) => v === 1).map(([k]) => k);
      const exclude = Object.entries(spec).filter(([_, v]) => v === 0).map(([k]) => k);
      return docs.map(d => {
        if (include.length) {
          const out: any = {};
          for (const k of include) out[k] = d[k];
          if (!('_id' in spec) || spec._id !== 0) out._id = d._id;
          return out;
        }
        const out = { ...d };
        for (const k of exclude) delete out[k];
        return out;
      });
    }
    return docs;
  }

  private applyGroup(docs: any[], spec: Record<string, any>): any[] {
    const groups = new Map<string, { key: any; docs: any[] }>();
    for (const doc of docs) {
      const keyVal = spec._id !== null && spec._id !== undefined ? resolve(doc, spec._id) : null;
      const keyStr = JSON.stringify(keyVal ?? null);
      if (!groups.has(keyStr)) groups.set(keyStr, { key: keyVal, docs: [] });
      groups.get(keyStr)!.docs.push(doc);
    }
    return Array.from(groups.values()).map(({ key, docs: group }) => {
      const row: any = { _id: key };
      for (const [field, acc] of Object.entries(spec)) {
        if (field === '_id') continue;
        row[field] = accumulate(group, acc as any);
      }
      return row;
    });
  }

  async listCollections(): Promise<string[]> {
    try {
      return fs.readdirSync(this.basePath)
        .filter(f => f.endsWith('.db') && !f.startsWith('_'))
        .map(f => f.replace('.db', ''));
    } catch { return []; }
  }
}

function resolve(doc: any, expr: any): any {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    return expr.slice(1).split('.').reduce((o, k) => o?.[k], doc);
  }
  return expr;
}

function numericValues(docs: any[], expr: any): number[] {
  const out: number[] = [];
  for (const d of docs) {
    const v = resolve(d, expr);
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isNaN(n)) continue;
    out.push(n);
  }
  return out;
}

function accumulate(docs: any[], acc: Record<string, any>): any {
  if (acc.$sum !== undefined) {
    if (acc.$sum === 1) return docs.length;
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
  if (acc.$count !== undefined) return docs.length;
  if (acc.$first !== undefined) return docs.length ? resolve(docs[0], acc.$first) : null;
  if (acc.$last !== undefined) return docs.length ? resolve(docs[docs.length - 1], acc.$last) : null;
  return null;
}

// Lightweight $match evaluator for use AFTER group stage (when delegation to NeDB isn't possible)
function matchesQuery(doc: any, query: Record<string, any>): boolean {
  for (const [k, v] of Object.entries(query)) {
    if (k === '$and') return (v as any[]).every(q => matchesQuery(doc, q));
    if (k === '$or') return (v as any[]).some(q => matchesQuery(doc, q));
    const fieldVal = k.split('.').reduce((o, key) => o?.[key], doc);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, opv] of Object.entries(v)) {
        if (op === '$eq' && fieldVal !== opv) return false;
        if (op === '$ne' && fieldVal === opv) return false;
        if (op === '$gt' && !(fieldVal > (opv as any))) return false;
        if (op === '$gte' && !(fieldVal >= (opv as any))) return false;
        if (op === '$lt' && !(fieldVal < (opv as any))) return false;
        if (op === '$lte' && !(fieldVal <= (opv as any))) return false;
        if (op === '$in' && !(opv as any[]).includes(fieldVal)) return false;
        if (op === '$nin' && (opv as any[]).includes(fieldVal)) return false;
        if (op === '$regex' && !new RegExp(opv as string).test(String(fieldVal ?? ''))) return false;
      }
    } else if (fieldVal !== v) return false;
  }
  return true;
}
