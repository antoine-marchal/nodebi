import { Router, Request } from 'express';
import Nedb from '@seald-io/nedb';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { Dashboard, DashboardRevision, Namespace } from '../types';
import { extractAndPersist, stripSecrets, removeDataSourceSecret } from '../secrets';
import { canAccessNamespace, canEditDashboard, DEFAULT_NAMESPACE_ID } from '../permissions';

const MAX_REVISIONS = 20;

export function dashboardsRouter(dataDir: string, db: Nedb<Dashboard>, namespaces: Nedb<Namespace>): Router {
  const router = Router();
  const revs = new Nedb<DashboardRevision>({ filename: path.join(dataDir, 'revisions.db'), autoload: true });

  async function namespaceFor(dashboard: Dashboard) {
    const id = dashboard.namespaceId || DEFAULT_NAMESPACE_ID;
    return id === DEFAULT_NAMESPACE_ID ? null : namespaces.findOneAsync({ _id: id });
  }
  async function canView(req: Request, dashboard: Dashboard) {
    const namespace = await namespaceFor(dashboard);
    if ((dashboard.namespaceId || DEFAULT_NAMESPACE_ID) !== DEFAULT_NAMESPACE_ID && !namespace) return false;
    return !!req.user && canAccessNamespace(req.user, namespace);
  }
  async function recordRevision(snapshot: Dashboard) {
    if (!snapshot._id) return;
    await revs.insertAsync({ _id: uuidv4(), dashboardId: snapshot._id, snapshot, createdAt: new Date().toISOString() });
    const all = await revs.findAsync({ dashboardId: snapshot._id });
    all.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const revision of all.slice(MAX_REVISIONS)) await revs.removeAsync({ _id: revision._id }, {});
  }

  router.get('/', async (req, res) => {
    try {
      const visible: Dashboard[] = [];
      for (const doc of await db.findAsync({})) if (await canView(req, doc)) visible.push(stripSecrets(doc));
      res.json(visible);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.get('/:id', async (req, res) => {
    try {
      const doc = await db.findOneAsync({ _id: req.params.id });
      if (!doc) return res.status(404).json({ error: 'Not found' });
      if (!(await canView(req, doc))) return res.status(403).json({ error: 'Forbidden' });
      res.json(stripSecrets(doc));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    try {
      if (!req.user || !['admin', 'operator'].includes(req.user.role)) return res.status(403).json({ error: 'Only admins and operators can create dashboards' });
      const namespaceId = String(req.body?.namespaceId || DEFAULT_NAMESPACE_ID);
      const namespace = namespaceId === DEFAULT_NAMESPACE_ID ? null : await namespaces.findOneAsync({ _id: namespaceId });
      if (namespaceId !== DEFAULT_NAMESPACE_ID && !namespace) return res.status(400).json({ error: 'Namespace not found' });
      if (!canAccessNamespace(req.user, namespace)) return res.status(403).json({ error: 'No access to this namespace' });
      const cleaned = extractAndPersist({ ...req.body, _id: uuidv4() });
      const now = new Date().toISOString();
      const dashboard: Dashboard = { ...cleaned, namespaceId, ownerId: req.user._id, ownerLogin: req.user.login, createdAt: now, updatedAt: now };
      const doc = await db.insertAsync(dashboard); await recordRevision(doc);
      res.status(201).json(stripSecrets(doc));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.put('/:id', async (req, res) => {
    try {
      const existing = await db.findOneAsync({ _id: req.params.id });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!req.user || !canEditDashboard(req.user, existing)) return res.status(403).json({ error: 'You can only edit your own dashboards' });
      const namespaceId = String(req.body?.namespaceId || existing.namespaceId || DEFAULT_NAMESPACE_ID);
      const namespace = namespaceId === DEFAULT_NAMESPACE_ID ? null : await namespaces.findOneAsync({ _id: namespaceId });
      if (namespaceId !== DEFAULT_NAMESPACE_ID && !namespace) return res.status(400).json({ error: 'Namespace not found' });
      if (!canAccessNamespace(req.user, namespace)) return res.status(403).json({ error: 'No access to this namespace' });
      const cleaned = extractAndPersist({ ...req.body, _id: req.params.id });
      const update: Dashboard = { ...cleaned, namespaceId, ownerId: existing.ownerId, ownerLogin: existing.ownerLogin, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
      delete update._id;
      await db.updateAsync({ _id: req.params.id }, { $set: update }, {});
      const doc = (await db.findOneAsync({ _id: req.params.id }))!; await recordRevision(doc);
      res.json(stripSecrets(doc));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const doc = await db.findOneAsync({ _id: req.params.id });
      if (!doc) return res.status(404).json({ error: 'Not found' });
      if (!req.user || !canEditDashboard(req.user, doc)) return res.status(403).json({ error: 'You can only delete your own dashboards' });
      for (const ds of doc.dataSources || []) if (ds.type === 'mongodb') removeDataSourceSecret(ds.id);
      await db.removeAsync({ _id: req.params.id }, {}); await revs.removeAsync({ dashboardId: req.params.id }, { multi: true });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  router.get('/:id/revisions', async (req, res) => {
    const doc = await db.findOneAsync({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (!(await canView(req, doc))) return res.status(403).json({ error: 'Forbidden' });
    const all = await revs.findAsync({ dashboardId: req.params.id });
    all.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json(all.map((r: any) => ({ _id: r._id, createdAt: r.createdAt })));
  });

  router.post('/:id/revisions/:revId/restore', async (req, res) => {
    const current = await db.findOneAsync({ _id: req.params.id });
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (!req.user || !canEditDashboard(req.user, current)) return res.status(403).json({ error: 'You can only restore your own dashboards' });
    const rev = await revs.findOneAsync({ _id: req.params.revId, dashboardId: req.params.id });
    if (!rev) return res.status(404).json({ error: 'Revision not found' });
    const update = { ...rev.snapshot, _id: undefined, ownerId: current.ownerId, ownerLogin: current.ownerLogin, updatedAt: new Date().toISOString() };
    delete update._id;
    await db.updateAsync({ _id: req.params.id }, { $set: update }, {});
    const doc = (await db.findOneAsync({ _id: req.params.id }))!; await recordRevision(doc);
    res.json(stripSecrets(doc));
  });
  return router;
}
