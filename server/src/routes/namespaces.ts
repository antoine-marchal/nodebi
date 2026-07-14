import { Router } from 'express';
import Nedb from '@seald-io/nedb';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../auth';
import { canAccessNamespace, DEFAULT_NAMESPACE_ID } from '../permissions';
import { Dashboard, Namespace, Role } from '../types';

const validRoles: Role[] = ['admin', 'operator', 'viewer'];
const normalize = (body: any) => ({
  name: String(body?.name || '').trim(), description: String(body?.description || ''),
  allowedRoles: Array.isArray(body?.allowedRoles) ? body.allowedRoles.filter((r: Role) => validRoles.includes(r)) : [],
  allowedUserIds: Array.isArray(body?.allowedUserIds) ? body.allowedUserIds.map(String) : [],
});

export function namespacesRouter(db: Nedb<Namespace>, dashboards: Nedb<Dashboard>): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const docs = await db.findAsync({});
    res.json(docs.filter(ns => req.user && canAccessNamespace(req.user, ns)));
  });
  router.post('/', requireRole('admin'), async (req, res) => {
    const data = normalize(req.body); if (!data.name) return res.status(400).json({ error: 'Name is required' });
    const now = new Date().toISOString();
    const doc: Namespace = { _id: uuidv4(), ...data, createdAt: now, updatedAt: now };
    await db.insertAsync(doc); res.status(201).json(doc);
  });
  router.put('/:id', requireRole('admin'), async (req, res) => {
    if (req.params.id === DEFAULT_NAMESPACE_ID) return res.status(400).json({ error: 'The default namespace cannot be changed' });
    const data = normalize(req.body); if (!data.name) return res.status(400).json({ error: 'Name is required' });
    const result = await db.updateAsync({ _id: req.params.id }, { $set: { ...data, updatedAt: new Date().toISOString() } }, {});
    const count = typeof result === 'number' ? result : (result as any).numAffected ?? 0;
    if (!count) return res.status(404).json({ error: 'Namespace not found' });
    res.json(await db.findOneAsync({ _id: req.params.id }));
  });
  router.delete('/:id', requireRole('admin'), async (req, res) => {
    if (req.params.id === DEFAULT_NAMESPACE_ID) return res.status(400).json({ error: 'The default namespace cannot be deleted' });
    if (await dashboards.countAsync({ namespaceId: req.params.id })) return res.status(409).json({ error: 'Move or delete dashboards in this namespace first' });
    const count = await db.removeAsync({ _id: req.params.id }, {});
    if (!count) return res.status(404).json({ error: 'Namespace not found' });
    res.json({ success: true });
  });
  return router;
}
