import { Router, Request, Response } from 'express';
import { NedbAdapter } from '../db/nedb-adapter';
import { MongoAdapter } from '../db/mongo-adapter';
import { QueryRequest, DataSource } from '../types';
import path from 'path';
import { USER_DATA_DIR, ENABLE_SEED, MAX_RESPONSE_ROWS, PROD } from '../config';
import { hydrate } from '../secrets';
import Nedb from '@seald-io/nedb';
import { Dashboard, Namespace } from '../types';
import { canAccessNamespace, DEFAULT_NAMESPACE_ID } from '../permissions';

function safeError(e: any): string {
  const msg = String(e?.message || e || 'Error');
  return PROD ? msg.replace(/\b\/[^\s]+/g, '<path>').slice(0, 250) : msg;
}

function safeNedbPath(input: string | undefined): string {
  if (!input) return USER_DATA_DIR;
  const candidate = path.isAbsolute(input) ? input : path.join(USER_DATA_DIR, input);
  const resolved = path.resolve(candidate);
  const root = path.resolve(USER_DATA_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error('nedbPath outside allowed directory');
  }
  return resolved;
}

export function queryRouter(dashboards: Nedb<Dashboard>, namespaces: Nedb<Namespace>): Router {
  const router = Router();

  async function resolveDataSource(req: Request): Promise<DataSource> {
    const dashboardId = req.body?.dashboardId as string | undefined;
    const dataSourceId = req.body?.dataSourceId as string | undefined;
    if (!dashboardId) {
      if (!req.user || req.user.role === 'viewer') throw new Error('FORBIDDEN');
      return req.body.dataSource as DataSource;
    }
    const dashboard = await dashboards.findOneAsync({ _id: dashboardId });
    if (!dashboard) throw new Error('DASHBOARD_NOT_FOUND');
    const namespace = dashboard.namespaceId && dashboard.namespaceId !== DEFAULT_NAMESPACE_ID
      ? await namespaces.findOneAsync({ _id: dashboard.namespaceId }) : null;
    if (!req.user || (dashboard.namespaceId && dashboard.namespaceId !== DEFAULT_NAMESPACE_ID && !namespace)
      || !canAccessNamespace(req.user, namespace)) throw new Error('FORBIDDEN');
    const source = dashboard.dataSources.find(item => item.id === dataSourceId);
    if (!source) throw new Error('DATASOURCE_NOT_FOUND');
    return source;
  }

  async function getAdapter(dsIn: DataSource) {
    const ds = hydrate(dsIn);
    if (ds.type === 'nedb') {
      const basePath = safeNedbPath(ds.nedbPath);
      const adapter = new NedbAdapter(basePath);
      await adapter.connect();
      return adapter;
    } else {
      if (!ds.mongoUri || !ds.mongoDatabase) throw new Error('MongoDB requires uri and database');
      const adapter = new MongoAdapter(ds.mongoUri, ds.mongoDatabase);
      await adapter.connect();
      return adapter;
    }
  }

  function capRows(rows: any[]): any[] {
    if (rows.length > MAX_RESPONSE_ROWS) return rows.slice(0, MAX_RESPONSE_ROWS);
    return rows;
  }

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as QueryRequest;
    let adapter;
    try {
      adapter = await getAdapter(await resolveDataSource(req));
      let result: any[];
      if (body.pipeline && body.pipeline.length > 0) {
        result = await adapter.aggregate({ collection: body.collection, pipeline: body.pipeline });
      } else {
        result = await adapter.find({
          collection: body.collection,
          query: body.queryFilter || {},
          limit: Math.min(body.limit ?? MAX_RESPONSE_ROWS, MAX_RESPONSE_ROWS),
        });
      }
      res.json(capRows(result));
    } catch (e: any) {
      if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Forbidden' });
      if (e.message?.endsWith('_NOT_FOUND')) return res.status(404).json({ error: 'Not found' });
      res.status(500).json({ error: safeError(e) });
    } finally {
      adapter?.disconnect().catch(() => {});
    }
  });

  router.post('/collections', async (req: Request, res: Response) => {
    let adapter;
    try {
      if (!req.user || req.user.role === 'viewer') return res.status(403).json({ error: 'Forbidden' });
      adapter = await getAdapter(req.body);
      const cols = await adapter.listCollections();
      res.json(cols);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    } finally {
      adapter?.disconnect().catch(() => {});
    }
  });

  // Return one sample document to power field-autocomplete in the UI
  router.post('/sample', async (req: Request, res: Response) => {
    let adapter;
    try {
      if (!req.user || req.user.role === 'viewer') return res.status(403).json({ error: 'Forbidden' });
      const { dataSource, collection } = req.body as { dataSource: DataSource; collection: string };
      adapter = await getAdapter(dataSource);
      const rows = await adapter.find({ collection, limit: 1 });
      res.json(rows[0] || {});
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    } finally {
      adapter?.disconnect().catch(() => {});
    }
  });

  router.post('/seed', async (req: Request, res: Response) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!ENABLE_SEED) {
      return res.status(403).json({ error: 'Seed disabled. Set ENABLE_SEED=true to enable.' });
    }
    try {
      const { collection, records } = req.body as { collection: string; records: object[] };
      if (!/^[a-zA-Z0-9_-]+$/.test(collection)) throw new Error('Invalid collection name');
      const adapter = new NedbAdapter(USER_DATA_DIR);
      await adapter.connect();
      const db = (adapter as any).getStore(collection);
      for (const rec of records) await db.insertAsync(rec);
      res.json({ inserted: records.length });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  return router;
}
