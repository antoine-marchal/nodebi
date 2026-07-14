import React, { useRef, useState } from 'react';
import {
  AppBar, Toolbar as MuiToolbar, Typography, Button, IconButton, Tooltip,
  TextField, Box, Chip, CircularProgress, ButtonGroup,
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, ListItemText, ListItemIcon, Divider, Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import StorageIcon from '@mui/icons-material/Storage';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import SyncIcon from '@mui/icons-material/Sync';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore, AutoSaveStatus } from '../../store';
import { Dashboard } from '../../types';
import DataSourceDialog from '../DataSources/DataSourceDialog';
import { dashboardApi, namespaceApi, shareApi } from '../../services/api';
import { Namespace } from '../../types';
import ProductMark from '../common/ProductMark';

interface Props {
  onSaved?: (d: Dashboard) => void;
}

function AutoSaveIndicator({ status, enabled }: { status: AutoSaveStatus; enabled: boolean }) {
  if (!enabled || status === 'idle') return null;
  if (status === 'pending') return <Chip icon={<SyncIcon sx={{ fontSize: '14px !important', animation: 'spin 1.5s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />} label="Pending" size="small" variant="outlined" sx={{ borderColor: 'warning.main', color: 'warning.main' }} />;
  if (status === 'saving') return <Chip icon={<CircularProgress size={12} color="inherit" />} label="Saving…" size="small" variant="outlined" sx={{ borderColor: 'info.main', color: 'info.main' }} />;
  if (status === 'saved') return <Chip icon={<CloudDoneIcon sx={{ fontSize: '14px !important' }} />} label="Saved" size="small" variant="outlined" sx={{ borderColor: 'success.main', color: 'success.main' }} />;
  if (status === 'error') return <Chip icon={<ErrorOutlineIcon sx={{ fontSize: '14px !important' }} />} label="Save failed" size="small" variant="outlined" color="error" />;
  return null;
}

export default function Toolbar({ onSaved }: Props) {
  const navigate = useNavigate();
  const {
    dashboard, isSaving, isDirty, isEditMode, setEditMode,
    save, exportJSON, importJSON, updateMeta,
    themeMode, toggleTheme, autoSaveEnabled, toggleAutoSave, autoSaveStatus,
    undo, redo, canUndo, canRedo,
  } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dsOpen, setDsOpen] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [metaOpen, setMetaOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareTtl, setShareTtl] = useState(7);
  const [shareErr, setShareErr] = useState('');
  const [revisions, setRevisions] = useState<{ _id: string; createdAt: string }[]>([]);
  const [revOpen, setRevOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);

  const handleSave = async () => {
    try {
      await save();
      onSaved?.(useDashboardStore.getState().dashboard);
    } catch { alert('Failed to save dashboard'); }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { importJSON(JSON.parse(ev.target?.result as string) as Dashboard); }
      catch { alert('Invalid dashboard JSON'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const openShare = async () => {
    setShareErr(''); setShareUrl(''); setShareOpen(true);
    if (!dashboard._id) {
      setShareErr('Save the dashboard first.');
      return;
    }
  };

  React.useEffect(() => { namespaceApi.list().then(setNamespaces).catch(() => setNamespaces([])); }, []);

  const generateShare = async () => {
    if (!dashboard._id) return;
    setShareErr('');
    try {
      const { token } = await shareApi.create(dashboard._id, shareTtl > 0 ? shareTtl : undefined);
      setShareUrl(`${window.location.origin}/shared/${token}`);
    } catch (e: any) { setShareErr(e?.response?.data?.error || e?.message || 'Failed'); }
  };

  const openRevisions = async () => {
    if (!dashboard._id) return;
    try { setRevisions(await dashboardApi.revisions(dashboard._id)); setRevOpen(true); }
    catch { /* ignore */ }
  };

  const restoreRevision = async (rid: string) => {
    if (!dashboard._id) return;
    try {
      const d = await dashboardApi.restoreRevision(dashboard._id, rid);
      useDashboardStore.getState().setDashboard(d);
      setRevOpen(false);
    } catch { /* ignore */ }
  };

  const startEditName = () => { setNameVal(dashboard.name); setEditName(true); };
  const commitName = () => { updateMeta({ name: nameVal }); setEditName(false); };

  const themeIcon = themeMode === 'system' ? <SettingsBrightnessIcon fontSize="small" /> : themeMode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />;

  return (
    <>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', zIndex: 10 }}>
        <MuiToolbar sx={{ gap: 1, minHeight: '68px !important', py: .5, px: { xs: '10px !important', md: '16px !important' }, overflow: 'hidden' }}>
          <Tooltip title="Back to dashboards"><IconButton size="small" onClick={() => navigate('/')}><ArrowBackIcon /></IconButton></Tooltip>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, pr: 1.5, mr: .5, borderRight: 1, borderColor: 'divider' }}><ProductMark compact /></Box>

          {editName ? (
            <TextField
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditName(false); }}
              size="small" autoFocus sx={{ width: { xs: 150, sm: 240 } }} variant="outlined"
            />
          ) : (
            <Box onClick={startEditName} sx={{ cursor: 'pointer', minWidth: 0, maxWidth: { xs: 150, sm: 260 }, '&:hover .dashboard-name': { color: 'primary.main' } }}>
              <Typography className="dashboard-name" variant="subtitle1" noWrap sx={{ transition: 'color .15s' }}>{dashboard.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1 }}>Click title to rename</Typography>
            </Box>
          )}

          {isDirty && autoSaveStatus === 'idle' && <Chip label="Unsaved" size="small" color="warning" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
          <AutoSaveIndicator status={autoSaveStatus} enabled={autoSaveEnabled} />

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: { xs: 'none', lg: 'flex' }, border: 1, borderColor: 'divider', borderRadius: 1, p: .25 }}>
            <Tooltip title="Undo (Ctrl+Z)"><span><IconButton size="small" onClick={undo} disabled={!canUndo()}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Redo (Ctrl+Shift+Z)"><span><IconButton size="small" onClick={redo} disabled={!canRedo()}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
          </Box>

          <Tooltip title="Data Sources">
            <Button startIcon={<StorageIcon />} size="small" onClick={() => setDsOpen(true)} variant="outlined" sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
              Sources ({dashboard.dataSources.length})
            </Button>
          </Tooltip>

          <ButtonGroup size="small" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <Button startIcon={<EditIcon />} variant={isEditMode ? 'contained' : 'outlined'} onClick={() => setEditMode(true)}>Edit</Button>
            <Button startIcon={<VisibilityIcon />} variant={!isEditMode ? 'contained' : 'outlined'} onClick={() => setEditMode(false)}>View</Button>
          </ButtonGroup>

          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          {dashboard._id && <Tooltip title="Open preview"><IconButton size="small" onClick={() => navigate(`/view/${dashboard._id}`)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><VisibilityIcon /></IconButton></Tooltip>}

          <Tooltip title="More actions"><IconButton size="small" onClick={event => setMoreAnchor(event.currentTarget)}><MoreHorizIcon /></IconButton></Tooltip>
          <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
            <MenuItem onClick={() => { setDsOpen(true); setMoreAnchor(null); }}><ListItemIcon><StorageIcon fontSize="small" /></ListItemIcon><ListItemText>Data sources ({dashboard.dataSources.length})</ListItemText></MenuItem>
            <MenuItem onClick={() => { setMetaOpen(true); setMoreAnchor(null); }}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Dashboard details</ListItemText></MenuItem>
            <MenuItem onClick={() => { toggleAutoSave(); setMoreAnchor(null); }}><ListItemIcon><SyncIcon fontSize="small" /></ListItemIcon><ListItemText>{autoSaveEnabled ? 'Turn off auto-save' : 'Turn on auto-save'}</ListItemText></MenuItem>
            <MenuItem onClick={() => { toggleTheme(); setMoreAnchor(null); }}><ListItemIcon>{themeIcon}</ListItemIcon><ListItemText>Theme: {themeMode}</ListItemText></MenuItem>
            <Divider />
            <MenuItem onClick={() => { fileInputRef.current?.click(); setMoreAnchor(null); }}><ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon><ListItemText>Import JSON</ListItemText></MenuItem>
            <MenuItem onClick={() => { exportJSON(); setMoreAnchor(null); }}><ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Export JSON</ListItemText></MenuItem>
            {dashboard._id && <Divider />}
            {dashboard._id && <MenuItem onClick={() => { openRevisions(); setMoreAnchor(null); }}><ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon><ListItemText>Revision history</ListItemText></MenuItem>}
            {dashboard._id && <MenuItem onClick={() => { openShare(); setMoreAnchor(null); }}><ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon><ListItemText>Share dashboard</ListItemText></MenuItem>}
          </Menu>

          <Button startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />} onClick={handleSave} variant="contained" size="small" disabled={isSaving}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Save</Box>
          </Button>
        </MuiToolbar>
      </AppBar>

      <DataSourceDialog open={dsOpen} onClose={() => setDsOpen(false)} />

      <Dialog open={metaOpen} onClose={() => setMetaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dashboard meta</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Name" size="small" value={dashboard.name} onChange={e => updateMeta({ name: e.target.value })} />
          <TextField label="Description" size="small" multiline rows={3} value={dashboard.description || ''} onChange={e => updateMeta({ description: e.target.value })} />
          <TextField label="Tags (comma separated)" size="small" value={(dashboard.tags || []).join(', ')}
            onChange={e => updateMeta({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
          <TextField select label="Namespace" size="small" value={dashboard.namespaceId || 'default'} onChange={e => updateMeta({ namespaceId: e.target.value })}>
            {namespaces.map(namespace => <MenuItem key={namespace._id} value={namespace._id}>{namespace.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={() => setMetaOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share dashboard</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shareErr && <Alert severity="error">{shareErr}</Alert>}
          <TextField label="Expiry (days, 0 = never)" type="number" size="small" value={shareTtl}
            onChange={e => setShareTtl(parseInt(e.target.value) || 0)} inputProps={{ min: 0 }} />
          <Button variant="contained" onClick={generateShare} disabled={!dashboard._id}>Generate read-only link</Button>
          {shareUrl && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField value={shareUrl} size="small" fullWidth InputProps={{ readOnly: true }} />
              <Button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setShareOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={revOpen} onClose={() => setRevOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Revision history</DialogTitle>
        <DialogContent dividers>
          {revisions.length === 0 && <Typography color="text.disabled" variant="body2">No revisions</Typography>}
          {revisions.map(r => (
            <Box key={r._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
              <ListItemText primary={new Date(r.createdAt).toLocaleString()} primaryTypographyProps={{ variant: 'body2' }} />
              <Button size="small" onClick={() => restoreRevision(r._id)}>Restore</Button>
            </Box>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setRevOpen(false)}>Close</Button></DialogActions>
      </Dialog>

    </>
  );
}
