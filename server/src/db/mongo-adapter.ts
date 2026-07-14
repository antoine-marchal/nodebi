import { MongoClient, Db } from 'mongodb';
import { DbAdapter, FindOptions, AggregateOptions } from './interface';

const pool = new Map<string, Promise<MongoClient>>();

function getClient(uri: string): Promise<MongoClient> {
  const cached = pool.get(uri);
  if (cached) return cached;
  const p = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  pool.set(uri, p);
  p.catch(() => pool.delete(uri));
  return p;
}

export async function closeMongoPool() {
  for (const p of pool.values()) {
    try { (await p).close(); } catch { /* best-effort shutdown */ }
  }
  pool.clear();
}

export class MongoAdapter implements DbAdapter {
  private uri: string;
  private dbName: string;
  private db: Db | null = null;

  constructor(uri: string, dbName: string) {
    this.uri = uri;
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    const client = await getClient(this.uri);
    this.db = client.db(this.dbName);
  }

  async disconnect(): Promise<void> {
    this.db = null;
  }

  private col(name: string) {
    if (!this.db) throw new Error('Not connected to MongoDB');
    return this.db.collection(name);
  }

  async find(opts: FindOptions): Promise<any[]> {
    let cursor = this.col(opts.collection).find(opts.query || {});
    if (opts.skip) cursor = cursor.skip(opts.skip);
    if (opts.limit) cursor = cursor.limit(opts.limit);
    return cursor.toArray();
  }

  async aggregate(opts: AggregateOptions): Promise<any[]> {
    return this.col(opts.collection).aggregate(opts.pipeline).toArray();
  }

  async listCollections(): Promise<string[]> {
    if (!this.db) return [];
    const cols = await this.db.listCollections().toArray();
    return cols.map(c => c.name);
  }
}
