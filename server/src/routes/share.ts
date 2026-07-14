import { Router, Request, Response } from 'express';
import Nedb from '@seald-io/nedb';
import path from 'path';
import { NedbAdapter } from '../db/nedb-adapter';
import { MongoAdapter } from '../db/mongo-adapter';
import { createToken, verifyToken } from '../share';
import { hydrate, stripSecrets } from '../secrets';
import { Dashboard, DataSource, Namespace } from '../types';
import { USER_DATA_DIR, MAX_RESPONSE_ROWS, PROD } from '../config';
import { canAccessNamespace, canEditDashboard, DEFAULT_NAMESPACE_ID } from '../permissions';

function safeError(e: any): string {
  return PROD ? 'Query failed' : String(e?.message || e);
}

export function shareRouter(db: Nedb<Dashboard>, namespaces: Nedb<Namespace>): Router {
  const router = Router();

  // Create a signed token (caller must be already authenticated by parent middleware)
  router.post('/create/:id', async (req: Request, res: Response) => {
    const { ttlDays } = (req.body || {}) as { ttlDays?: number };
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!req.user || !canEditDashboard(req.user, doc)) return res.status(403).json({ error: 'You can only share your own dashboards' });
    const namespace = (doc.namespaceId && doc.namespaceId !== DEFAULT_NAMESPACE_ID)
      ? await namespaces.findOneAsync({ _id: doc.namespaceId }) : null;
    if (doc.namespaceId && doc.namespaceId !== DEFAULT_NAMESPACE_ID && !namespace) return res.status(409).json({ error: 'Dashboard namespace no longer exists' });
    if (!canAccessNamespace(req.user, namespace)) return res.status(403).json({ error: 'No access to this namespace' });
    const payload: any = { id: req.params.id };
    if (ttlDays && ttlDays > 0) payload.exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
    res.json({ token: createToken(payload) });
  });

  // Public — verify token, return stripped dashboard
  router.get('/dashboard/:token', async (req: Request, res: Response) => {
    const p = verifyToken(req.params.token);
    if (!p) return res.status(403).json({ error: 'Invalid or expired token' });
    const doc = await db.findOneAsync({ _id: p.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(stripSecrets(doc));
  });

  // Public — proxy query for a specific dashboard's data sources only
  router.post('/query/:token', async (req: Request, res: Response) => {
    const p = verifyToken(req.params.token);
    if (!p) return res.status(403).json({ error: 'Invalid or expired token' });
    const doc = await db.findOneAsync({ _id: p.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const { dataSourceId, collection, queryFilter, pipeline, limit } = req.body as {
      dataSourceId: string; collection: string; queryFilter?: object; pipeline?: object[]; limit?: number;
    };
    const dsRef = (doc.dataSources || []).find((d: DataSource) => d.id === dataSourceId);
    if (!dsRef) return res.status(404).json({ error: 'Data source not found in this dashboard' });
    const ds = hydrate(dsRef);

    let adapter;
    try {
      if (ds.type === 'nedb') {
        const base = path.resolve(ds.nedbPath
          ? path.isAbsolute(ds.nedbPath) ? ds.nedbPath : path.join(USER_DATA_DIR, ds.nedbPath)
          : USER_DATA_DIR);
        const root = path.resolve(USER_DATA_DIR);
        if (!base.startsWith(root)) throw new Error('Forbidden');
        adapter = new NedbAdapter(base);
      } else {
        if (!ds.mongoUri || !ds.mongoDatabase) throw new Error('MongoDB requires uri and database');
        adapter = new MongoAdapter(ds.mongoUri, ds.mongoDatabase);
      }
      await adapter.connect();
      const rows = pipeline?.length
        ? await adapter.aggregate({ collection, pipeline })
        : await adapter.find({ collection, query: queryFilter || {}, limit: Math.min(limit ?? MAX_RESPONSE_ROWS, MAX_RESPONSE_ROWS) });
      res.json(rows.length > MAX_RESPONSE_ROWS ? rows.slice(0, MAX_RESPONSE_ROWS) : rows);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    } finally {
      adapter?.disconnect().catch(() => {});
    }
  });

  return router;
}
