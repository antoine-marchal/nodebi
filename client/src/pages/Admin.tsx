import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardActionArea, CardContent, Checkbox, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputAdornment, InputLabel, ListItemText, MenuItem, Select, Stack, Tab, Tabs, TextField, Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import { useNavigate } from 'react-router-dom';
import ProductMark from '../components/common/ProductMark';
import { useAuth } from '../auth';
import { namespaceApi, usersApi } from '../services/api';
import { useDashboardStore } from '../store';
import { Namespace, Role, User } from '../types';

const roles: Role[] = ['admin', 'operator', 'viewer'];
const draftNamespace = (): Namespace => ({ _id: '', name: '', description: '', allowedRoles: [], allowedUserIds: [] });
const roleDescription: Record<Role, string> = {
  admin: 'Full access to dashboards and administration',
  operator: 'Can create and manage assigned dashboards',
  viewer: 'Read-only access to permitted dashboards',
};

export default function Admin() {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuth();
  const { themeMode, toggleTheme } = useDashboardStore();
  const [users, setUsers] = useState<User[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [section, setSection] = useState<'users' | 'namespaces'>('users');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [namespaceDialog, setNamespaceDialog] = useState(false);
  const [editingNamespace, setEditingNamespace] = useState<Namespace | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'user' | 'namespace'; id: string; name: string } | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [draft, setDraft] = useState(draftNamespace());

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [nextUsers, nextNamespaces] = await Promise.all([usersApi.list(), namespaceApi.list()]);
      setUsers(nextUsers);
      setNamespaces(nextNamespaces);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load administration data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter(item => !query || item.login.toLowerCase().includes(query) || item.role.includes(query));
  }, [search, users]);
  const filteredNamespaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    return namespaces.filter(item => !query || item.name.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query));
  }, [namespaces, search]);

  const openCreateUser = () => {
    setEditingUser(null); setLogin(''); setPassword(''); setRole('viewer'); setUserDialog(true);
  };
  const openEditUser = (item: User) => {
    setEditingUser(item); setLogin(item.login); setPassword(''); setRole(item.role); setUserDialog(true);
  };
  const saveUser = async () => {
    try {
      setSubmitting(true); setError('');
      if (editingUser) await usersApi.update(editingUser._id, { role });
      else await usersApi.create({ login: login.trim(), password: password || undefined, role });
      setUserDialog(false); await load();
    } catch (e: any) { setError(e?.response?.data?.error || `Failed to ${editingUser ? 'update' : 'create'} user.`); }
    finally { setSubmitting(false); }
  };

  const openCreateNamespace = () => {
    setEditingNamespace(null); setDraft(draftNamespace()); setNamespaceDialog(true);
  };
  const openEditNamespace = (item: Namespace) => {
    setEditingNamespace(item); setDraft({ ...item, allowedRoles: [...item.allowedRoles], allowedUserIds: [...item.allowedUserIds] }); setNamespaceDialog(true);
  };
  const saveNamespace = async () => {
    try {
      setSubmitting(true); setError('');
      if (editingNamespace) await namespaceApi.update(editingNamespace._id, draft);
      else await namespaceApi.create(draft);
      setNamespaceDialog(false); await load();
    } catch (e: any) { setError(e?.response?.data?.error || `Failed to ${editingNamespace ? 'update' : 'create'} namespace.`); }
    finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true); setError('');
      if (deleteTarget.type === 'user') await usersApi.delete(deleteTarget.id);
      else await namespaceApi.delete(deleteTarget.id);
      setDeleteTarget(null); await load();
    } catch (e: any) { setError(e?.response?.data?.error || `Failed to delete ${deleteTarget.type}.`); }
    finally { setSubmitting(false); }
  };

  const themeIcon = themeMode === 'system' ? <SettingsBrightnessIcon fontSize="small" /> : themeMode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />;
  const countForRole = (target: Role) => users.filter(item => item.role === target).length;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ minHeight: 72, py: .75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <ProductMark />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${currentUser?.login} · ${currentUser?.role}`} size="small" variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
            <Tooltip title={`Theme: ${themeMode}`}><IconButton aria-label={`Theme: ${themeMode}`} onClick={toggleTheme}>{themeIcon}</IconButton></Tooltip>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} color="inherit" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Dashboards</Button>
            <Tooltip title="Sign out"><IconButton onClick={() => { logout(); navigate('/login'); }}><LogoutIcon /></IconButton></Tooltip>
          </Stack>
        </Container>
      </Box>

      <Container component="main" maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, flex: 1 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={3} sx={{ mb: 4 }}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={700} letterSpacing=".12em">Workspace controls</Typography>
            <Typography variant="h3" sx={{ mt: .5, fontSize: { xs: 32, md: 42 } }}>Administration</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 620 }}>Manage who can access NodeBI and organize dashboards into secure namespaces.</Typography>
          </Box>
          <Stack direction="row" spacing={1.25}>
            <Stat label="People" value={users.length} icon={<GroupsOutlinedIcon />} />
            <Stat label="Admins" value={countForRole('admin')} icon={<ShieldOutlinedIcon />} />
            <Stat label="Namespaces" value={namespaces.length} icon={<WorkspacesOutlinedIcon />} />
          </Stack>
        </Stack>

        {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Retry</Button>} onClose={() => setError('')} sx={{ mb: 3 }}>{error}</Alert>}

        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 1.25, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Tabs value={section} onChange={(_, value) => { setSection(value); setSearch(''); }} aria-label="Administration sections">
              <Tab value="users" icon={<GroupsOutlinedIcon fontSize="small" />} iconPosition="start" label="People" />
              <Tab value="namespaces" icon={<WorkspacesOutlinedIcon fontSize="small" />} iconPosition="start" label="Namespaces" />
            </Tabs>
          </Box>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h6">{section === 'users' ? 'People and roles' : 'Access namespaces'}</Typography>
                <Typography variant="body2" color="text.secondary">{section === 'users' ? 'Invite people and control their workspace permissions.' : 'Group dashboards and decide which roles or people can see them.'}</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TextField size="small" placeholder={`Search ${section === 'users' ? 'people' : 'namespaces'}`} value={search} onChange={event => setSearch(event.target.value)} sx={{ width: { xs: '100%', sm: 240 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                <Button variant="contained" startIcon={<AddIcon />} onClick={section === 'users' ? openCreateUser : openCreateNamespace} sx={{ whiteSpace: 'nowrap' }}>{section === 'users' ? 'Add person' : 'New namespace'}</Button>
              </Stack>
            </Stack>

            {loading ? <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
              : section === 'users' ? <UsersSection users={filteredUsers} currentUserId={currentUser?._id} onEdit={openEditUser} onDelete={item => setDeleteTarget({ type: 'user', id: item._id, name: item.login })} />
                : <NamespacesSection namespaces={filteredNamespaces} users={users} onEdit={openEditNamespace} onDelete={item => setDeleteTarget({ type: 'namespace', id: item._id, name: item.name })} />}
          </Box>
        </Card>
      </Container>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="xl" sx={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">NodeBI workspace administration</Typography>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Return to dashboards</Button>
        </Container>
      </Box>

      <UserDialog open={userDialog} editing={editingUser} login={login} password={password} role={role} submitting={submitting} onLogin={setLogin} onPassword={setPassword} onRole={setRole} onClose={() => setUserDialog(false)} onSave={saveUser} />
      <NamespaceDialog open={namespaceDialog} editing={editingNamespace} namespace={draft} users={users} submitting={submitting} onChange={setDraft} onClose={() => setNamespaceDialog(false)} onSave={saveNamespace} />
      <DeleteDialog target={deleteTarget} submitting={submitting} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </Box>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactElement }) {
  return <Box sx={{ minWidth: 106, p: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: .75, color: 'text.secondary' }}>{React.cloneElement(icon, { sx: { fontSize: 17 } })}<Typography variant="caption">{label}</Typography></Box><Typography variant="h5" sx={{ mt: .25 }}>{value}</Typography></Box>;
}

function UsersSection({ users, currentUserId, onEdit, onDelete }: { users: User[]; currentUserId?: string; onEdit: (user: User) => void; onDelete: (user: User) => void }) {
  if (!users.length) return <EmptyState icon={<GroupsOutlinedIcon />} title="No people found" detail="Try a different search or add someone to the workspace." />;
  return <Stack spacing={1}>{users.map(user => <Box key={user._id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, '&:hover': { bgcolor: 'action.hover' } }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
      <Avatar sx={{ width: 40, height: 40, bgcolor: 'action.selected', color: 'primary.main', fontWeight: 700 }}>{user.login.slice(0, 1).toUpperCase()}</Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" alignItems="center" spacing={.75}><Typography fontWeight={600} noWrap>{user.login}</Typography>{user._id === currentUserId && <Chip label="You" size="small" variant="outlined" />}</Stack><Typography variant="caption" color="text.secondary">{roleDescription[user.role]}</Typography></Box>
    </Stack>
    <Stack direction="row" spacing={.5} alignItems="center" justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}>
      <Chip icon={user.role === 'admin' ? <ShieldOutlinedIcon /> : undefined} label={user.role} size="small" color={user.role === 'admin' ? 'primary' : 'default'} variant={user.role === 'admin' ? 'filled' : 'outlined'} />
      <Tooltip title="Edit role"><IconButton size="small" onClick={() => onEdit(user)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title={user._id === currentUserId ? 'You cannot delete your own account' : 'Delete person'}><span><IconButton size="small" color="error" disabled={user._id === currentUserId} onClick={() => onDelete(user)}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
    </Stack>
  </Box>)}</Stack>;
}

function NamespacesSection({ namespaces, users, onEdit, onDelete }: { namespaces: Namespace[]; users: User[]; onEdit: (namespace: Namespace) => void; onDelete: (namespace: Namespace) => void }) {
  if (!namespaces.length) return <EmptyState icon={<WorkspacesOutlinedIcon />} title="No namespaces found" detail="Try a different search or create a namespace." />;
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2 }}>{namespaces.map(namespace => {
    const builtIn = namespace._id === 'default';
    const memberCount = namespace.allowedUserIds.length;
    return <Card key={namespace._id} variant="outlined" sx={{ boxShadow: 'none', height: '100%' }}><CardActionArea disabled={builtIn} onClick={() => onEdit(namespace)} sx={{ height: '100%', alignItems: 'stretch' }}><CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center' }}>{builtIn ? <LockOutlinedIcon fontSize="small" /> : <WorkspacesOutlinedIcon fontSize="small" />}</Box><Chip label={builtIn ? 'Built in' : namespace._id} size="small" variant="outlined" /></Stack>
      <Typography variant="h6" sx={{ mt: 2 }}>{namespace.name}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5, minHeight: 40 }}>{namespace.description || 'No description provided.'}</Typography>
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" spacing={.75} sx={{ flexWrap: 'wrap', gap: .75 }}>{namespace.allowedRoles.length ? namespace.allowedRoles.map(role => <Chip key={role} size="small" label={role} />) : <Chip size="small" label={builtIn ? 'All authenticated users' : 'No role access'} variant="outlined" />}</Stack>
      <Box sx={{ mt: 'auto', pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="caption" color="text.secondary">{memberCount} direct {memberCount === 1 ? 'member' : 'members'}{memberCount > 0 ? ` · ${namespace.allowedUserIds.map(id => users.find(user => user._id === id)?.login).filter(Boolean).slice(0, 2).join(', ')}` : ''}</Typography>{!builtIn && <Stack direction="row" spacing={.5}><Tooltip title="Manage access"><IconButton size="small" onClick={event => { event.stopPropagation(); onEdit(namespace); }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete namespace"><IconButton size="small" color="error" onClick={event => { event.stopPropagation(); onDelete(namespace); }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></Stack>}</Box>
    </CardContent></CardActionArea></Card>;
  })}</Box>;
}

function EmptyState({ icon, title, detail }: { icon: React.ReactElement; title: string; detail: string }) {
  return <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center', textAlign: 'center' }}><Box><Box sx={{ width: 58, height: 58, borderRadius: 2.5, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>{icon}</Box><Typography variant="h6">{title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{detail}</Typography></Box></Box>;
}

function UserDialog({ open, editing, login, password, role, submitting, onLogin, onPassword, onRole, onClose, onSave }: { open: boolean; editing: User | null; login: string; password: string; role: Role; submitting: boolean; onLogin: (value: string) => void; onPassword: (value: string) => void; onRole: (value: Role) => void; onClose: () => void; onSave: () => void }) {
  return <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth><DialogTitle>{editing ? 'Edit workspace role' : 'Add a person'}</DialogTitle><DialogContent dividers><Stack spacing={2.25} sx={{ pt: .5 }}><Alert severity="info" icon={<AdminPanelSettingsOutlinedIcon />}>{editing ? 'Role changes take effect the next time this person accesses a protected resource.' : 'Create a password account, or leave the password blank for an SSO-only account.'}</Alert><TextField label="Login" autoFocus={!editing} value={login} onChange={event => onLogin(event.target.value)} disabled={Boolean(editing)} fullWidth />{!editing && <TextField label="Password" type="password" value={password} onChange={event => onPassword(event.target.value)} helperText="Optional for SSO-only accounts" fullWidth />}<FormControl fullWidth><InputLabel>Workspace role</InputLabel><Select label="Workspace role" value={role} onChange={event => onRole(event.target.value as Role)}>{roles.map(item => <MenuItem key={item} value={item}><ListItemText primary={item[0].toUpperCase() + item.slice(1)} secondary={roleDescription[item]} /></MenuItem>)}</Select></FormControl></Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="contained" onClick={onSave} disabled={submitting || !login.trim()}>{submitting ? 'Saving…' : editing ? 'Save role' : 'Add person'}</Button></DialogActions></Dialog>;
}

function NamespaceDialog({ open, editing, namespace, users, submitting, onChange, onClose, onSave }: { open: boolean; editing: Namespace | null; namespace: Namespace; users: User[]; submitting: boolean; onChange: (namespace: Namespace) => void; onClose: () => void; onSave: () => void }) {
  return <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth><DialogTitle>{editing ? `Manage ${editing.name}` : 'Create a namespace'}</DialogTitle><DialogContent dividers><Stack spacing={2.25} sx={{ pt: .5 }}><Box><Typography variant="subtitle2">Namespace details</Typography><Typography variant="body2" color="text.secondary">Use a clear name so dashboard owners know where their work belongs.</Typography></Box><TextField label="Name" autoFocus value={namespace.name} onChange={event => onChange({ ...namespace, name: event.target.value })} fullWidth /><TextField label="Description" value={namespace.description || ''} onChange={event => onChange({ ...namespace, description: event.target.value })} multiline minRows={2} fullWidth /><Divider /><Box><Typography variant="subtitle2">Access rules</Typography><Typography variant="body2" color="text.secondary">Admins always retain access. Add roles for broad access or select individual people.</Typography></Box><AclFields namespace={namespace} users={users} onChange={onChange} /></Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={submitting}>Cancel</Button><Button variant="contained" onClick={onSave} disabled={submitting || !namespace.name.trim()}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Create namespace'}</Button></DialogActions></Dialog>;
}

function DeleteDialog({ target, submitting, onClose, onConfirm }: { target: { type: 'user' | 'namespace'; id: string; name: string } | null; submitting: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Dialog open={Boolean(target)} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth><DialogTitle>Delete {target?.type}</DialogTitle><DialogContent><Typography>Delete <strong>{target?.name}</strong>? This action cannot be undone.</Typography>{target?.type === 'namespace' && <Alert severity="warning" sx={{ mt: 2 }}>Dashboards assigned to this namespace may need to be moved.</Alert>}</DialogContent><DialogActions><Button onClick={onClose} disabled={submitting}>Cancel</Button><Button color="error" variant="contained" onClick={onConfirm} disabled={submitting}>{submitting ? 'Deleting…' : 'Delete'}</Button></DialogActions></Dialog>;
}

function AclFields({ namespace, users, onChange }: { namespace: Namespace; users: User[]; onChange: (namespace: Namespace) => void }) {
  return <Stack spacing={2}>
    <FormControl fullWidth><InputLabel>Allowed roles</InputLabel><Select multiple label="Allowed roles" value={namespace.allowedRoles} renderValue={value => value.map(item => item[0].toUpperCase() + item.slice(1)).join(', ')} onChange={event => onChange({ ...namespace, allowedRoles: event.target.value as Role[] })}>{roles.filter(item => item !== 'admin').map(item => <MenuItem key={item} value={item}><Checkbox checked={namespace.allowedRoles.includes(item)} /><ListItemText primary={item[0].toUpperCase() + item.slice(1)} secondary={roleDescription[item]} /></MenuItem>)}</Select></FormControl>
    <FormControl fullWidth><InputLabel>Individual people</InputLabel><Select multiple label="Individual people" value={namespace.allowedUserIds} renderValue={ids => ids.map(id => users.find(user => user._id === id)?.login || id).join(', ')} onChange={event => onChange({ ...namespace, allowedUserIds: event.target.value as string[] })}>{users.filter(user => user.role !== 'admin').map(user => <MenuItem key={user._id} value={user._id}><Checkbox checked={namespace.allowedUserIds.includes(user._id)} /><ListItemText primary={user.login} secondary={user.role} /></MenuItem>)}</Select></FormControl>
  </Stack>;
}
