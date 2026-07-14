import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NedbAdapter } from './nedb-adapter';

describe('NedbAdapter aggregator', () => {
  let dir: string;
  let adapter: NedbAdapter;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nedb-test-'));
    adapter = new NedbAdapter(dir);
    await adapter.connect();
    const store = adapter.getStore('orders');
    await store.insertAsync({ category: 'A', value: 10, createdAt: '2026-01-01' });
    await store.insertAsync({ category: 'A', value: 0, createdAt: '2026-01-02' });
    await store.insertAsync({ category: 'B', value: 5, createdAt: '2026-02-01' });
    await store.insertAsync({ category: 'B', value: undefined, createdAt: '2026-02-02' });
  });

  afterEach(async () => {
    await adapter.disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('groups and sums numeric values, treating undefined as missing (not 0)', async () => {
    const out = await adapter.aggregate({
      collection: 'orders',
      pipeline: [{ $group: { _id: '$category', total: { $sum: '$value' } } }, { $sort: { _id: 1 } }],
    });
    expect(out).toEqual([
      { _id: 'A', total: 10 },
      { _id: 'B', total: 5 },
    ]);
  });

  it('computes average ignoring missing values', async () => {
    const out = await adapter.aggregate({
      collection: 'orders',
      pipeline: [{ $group: { _id: '$category', avg: { $avg: '$value' } } }, { $sort: { _id: 1 } }],
    });
    expect(out).toEqual([
      { _id: 'A', avg: 5 },
      { _id: 'B', avg: 5 },
    ]);
  });

  it('supports $gt operator in $match via delegation', async () => {
    const out = await adapter.aggregate({
      collection: 'orders',
      pipeline: [{ $match: { value: { $gt: 4 } } }, { $group: { _id: null, n: { $sum: 1 } } }],
    });
    expect(out).toEqual([{ _id: null, n: 2 }]);
  });

  it('throws on unsupported pipeline stage', async () => {
    await expect(adapter.aggregate({
      collection: 'orders',
      pipeline: [{ $bogus: {} } as any],
    })).rejects.toThrow(/Unsupported pipeline stage/);
  });
});
