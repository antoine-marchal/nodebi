import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Container, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { namespaceApi, usersApi } from '../services/api';
import { Namespace, Role, User } from '../types';

const roles: Role[] = ['admin', 'operator', 'viewer'];
const draftNamespace = (): Namespace => ({ _id: '', name: '', description: '', allowedRoles: [], allowedUserIds: [] });

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]); const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [login, setLogin] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<Role>('viewer');
  const [draft, setDraft] = useState(draftNamespace()); const [error, setError] = useState('');
  const load = async () => { try { const [u, n] = await Promise.all([usersApi.list(), namespaceApi.list()]); setUsers(u); setNamespaces(n); } catch (e: any) { setError(e?.response?.data?.error || 'Failed to load administration data'); } };
  useEffect(() => { void load(); }, []);
  const createUser = async () => { try { await usersApi.create({ login, password: password || undefined, role }); setLogin(''); setPassword(''); await load(); } catch (e: any) { setError(e?.response?.data?.error || 'Failed to create user'); } };
  const createNamespace = async () => { try { await namespaceApi.create(draft); setDraft(draftNamespace()); await load(); } catch (e: any) { setError(e?.response?.data?.error || 'Failed to create namespace'); } };
  const updateNamespace = async (ns: Namespace) => { try { await namespaceApi.update(ns._id, ns); await load(); } catch (e: any) { setError(e?.response?.data?.error || 'Failed to update namespace'); } };
  const patchNamespace = (id: string, patch: Partial<Namespace>) => setNamespaces(list => list.map(ns => ns._id === id ? { ...ns, ...patch } : ns));

  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}><Container maxWidth="lg" sx={{ py: 4 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}><Box><Typography variant="h4">Administration</Typography><Typography color="text.secondary">Manage accounts and namespace access.</Typography></Box><Button onClick={() => navigate('/')}>Back to dashboards</Button></Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Typography variant="h6" sx={{ mb: 1.5 }}>Users</Typography>
    <Card sx={{ mb: 3 }}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
      <TextField label="Login" size="small" value={login} onChange={e => setLogin(e.target.value)} />
      <TextField label="Password (blank for SSO-only)" type="password" size="small" value={password} onChange={e => setPassword(e.target.value)} sx={{ minWidth: 240 }} />
      <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Role</InputLabel><Select label="Role" value={role} onChange={e => setRole(e.target.value as Role)}>{roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl>
      <Button variant="contained" onClick={createUser} disabled={!login}>Add user</Button>
    </Stack></CardContent></Card>
    <Stack spacing={1.25} sx={{ mb: 4 }}>{users.map(user => <Card key={user._id}><CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}><Typography sx={{ flex: 1 }}>{user.login}</Typography><FormControl size="small" sx={{ minWidth: 130 }}><Select value={user.role} onChange={async e => { await usersApi.update(user._id, { role: e.target.value as Role }); await load(); }}>{roles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl><Button color="error" onClick={async () => { if (confirm(`Delete ${user.login}?`)) { await usersApi.delete(user._id); await load(); } }}>Delete</Button></CardContent></Card>)}</Stack>

    <Typography variant="h6" sx={{ mb: 1.5 }}>Namespaces</Typography>
    <Card sx={{ mb: 2 }}><CardContent><Stack spacing={1.5}><TextField label="Namespace name" size="small" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /><TextField label="Description" size="small" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /><AclFields namespace={draft} users={users} onChange={setDraft} /><Button variant="contained" onClick={createNamespace} disabled={!draft.name}>Create namespace</Button></Stack></CardContent></Card>
    <Stack spacing={2}>{namespaces.map(ns => <Card key={ns._id}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between" alignItems="center"><TextField label="Name" size="small" value={ns.name} disabled={ns._id === 'default'} onChange={e => patchNamespace(ns._id, { name: e.target.value })} /><Chip label={ns._id === 'default' ? 'Built in' : ns._id} size="small" /></Stack><TextField label="Description" size="small" value={ns.description || ''} disabled={ns._id === 'default'} onChange={e => patchNamespace(ns._id, { description: e.target.value })} />{ns._id !== 'default' && <><AclFields namespace={ns} users={users} onChange={next => patchNamespace(ns._id, next)} /><Stack direction="row" spacing={1}><Button variant="contained" onClick={() => updateNamespace(ns)}>Save access</Button><Button color="error" onClick={async () => { if (confirm(`Delete namespace ${ns.name}?`)) { await namespaceApi.delete(ns._id); await load(); } }}>Delete</Button></Stack></>}</Stack></CardContent></Card>)}</Stack>
  </Container></Box>;
}

function AclFields({ namespace, users, onChange }: { namespace: Namespace; users: User[]; onChange: (namespace: Namespace) => void }) {
  return <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
    <FormControl size="small" fullWidth><InputLabel>Allowed roles</InputLabel><Select multiple label="Allowed roles" value={namespace.allowedRoles} renderValue={v => v.join(', ')} onChange={e => onChange({ ...namespace, allowedRoles: e.target.value as Role[] })}>{roles.filter(r => r !== 'admin').map(r => <MenuItem key={r} value={r}><Checkbox checked={namespace.allowedRoles.includes(r)} /><ListItemText primary={r} /></MenuItem>)}</Select></FormControl>
    <FormControl size="small" fullWidth><InputLabel>Allowed users</InputLabel><Select multiple label="Allowed users" value={namespace.allowedUserIds} renderValue={ids => ids.map(id => users.find(u => u._id === id)?.login || id).join(', ')} onChange={e => onChange({ ...namespace, allowedUserIds: e.target.value as string[] })}>{users.filter(u => u.role !== 'admin').map(u => <MenuItem key={u._id} value={u._id}><Checkbox checked={namespace.allowedUserIds.includes(u._id)} /><ListItemText primary={`${u.login} (${u.role})`} /></MenuItem>)}</Select></FormControl>
  </Stack>;
}
