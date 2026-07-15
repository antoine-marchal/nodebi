import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress,
  Container, Grid, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import SearchIcon from '@mui/icons-material/Search';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import { useNavigate } from 'react-router-dom';
import ProductMark from '../components/common/ProductMark';
import { dashboardApi } from '../services/api';
import { useDashboardStore } from '../store';
import { Dashboard } from '../types';
import { useAuth } from '../auth';

const formatDate = (value?: string) => {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
};

export default function Home() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeNamespace, setActiveNamespace] = useState<string | null>(null);
  const { newDashboard, importJSON, themeMode, toggleTheme } = useDashboardStore();
  const { user, isAdmin, canCreate, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setDashboards(await dashboardApi.list());
    } catch {
      setError('We could not load your dashboards. Check the server connection and try again.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const tags = useMemo(() => Array.from(new Set(dashboards.flatMap(d => d.tags || []))).sort(), [dashboards]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dashboards.filter(d => {
      if (activeTag && !(d.tags || []).includes(activeTag)) return false;
      if (activeSource && !d.dataSources.some(source => source.name === activeSource)) return false;
      if (activeNamespace && (d.namespaceId || 'default') !== activeNamespace) return false;
      return !query || d.name.toLowerCase().includes(query)
        || (d.description || '').toLowerCase().includes(query)
        || (d.tags || []).some(tag => tag.toLowerCase().includes(query))
        || d.dataSources.some(source => source.name.toLowerCase().includes(query))
        || (d.namespaceId || 'default').toLowerCase().includes(query);
    });
  }, [activeNamespace, activeSource, activeTag, dashboards, search]);

  const totals = useMemo(() => ({
    widgets: dashboards.reduce((sum, d) => sum + d.widgets.length, 0),
    sources: new Set(dashboards.flatMap(d => d.dataSources.map(ds => ds.name))).size,
  }), [dashboards]);

  const handleNew = () => { newDashboard(); navigate('/designer'); };
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dashboard? This action cannot be undone.')) return;
    await dashboardApi.delete(id);
    await load();
  };
  const handleExport = (dashboard: Dashboard) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dashboard, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${dashboard.name.replace(/\s+/g, '_')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = result => {
      try {
        const dashboard = JSON.parse(result.target?.result as string) as Dashboard;
        delete dashboard._id;
        importJSON(dashboard);
        navigate('/designer');
      } catch { alert('That file is not a valid NodeBI dashboard.'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const themeIcon = themeMode === 'system' ? <SettingsBrightnessIcon fontSize="small" /> : themeMode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ minHeight: 72, py: .75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <ProductMark />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`${user?.login} · ${user?.role}`} size="small" variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
            <Tooltip title={`Theme: ${themeMode}`}><IconButton aria-label={`Theme: ${themeMode}`} onClick={toggleTheme}>{themeIcon}</IconButton></Tooltip>
            {isAdmin && <Tooltip title="Administration"><IconButton onClick={() => navigate('/admin')}><AdminPanelSettingsIcon /></IconButton></Tooltip>}
            <input ref={fileInputRef} type="file" accept=".json" hidden onChange={handleImport} />
            {canCreate && <Button startIcon={<FileUploadOutlinedIcon />} onClick={() => fileInputRef.current?.click()} color="inherit" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Import</Button>}
            {canCreate && <Button startIcon={<AddIcon />} onClick={handleNew} variant="contained">New dashboard</Button>}
            <Tooltip title="Sign out"><IconButton onClick={() => { logout(); navigate('/login'); }}><LogoutIcon /></IconButton></Tooltip>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3, mb: 4, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={700} letterSpacing=".12em">Workspace overview</Typography>
            <Typography variant="h3" sx={{ mt: .5, fontSize: { xs: 32, md: 42 } }}>Turn data into decisions.</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 580 }}>Build, manage, and share focused dashboards from one calm workspace.</Typography>
          </Box>
          <Stack direction="row" spacing={1.25}>
            {[
              { label: 'Dashboards', value: dashboards.length, icon: <DashboardCustomizeIcon /> },
              { label: 'Widgets', value: totals.widgets, icon: <WidgetsOutlinedIcon /> },
              { label: 'Sources', value: totals.sources, icon: <StorageOutlinedIcon /> },
            ].map(stat => (
              <Box key={stat.label} sx={{ minWidth: 106, p: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: .75, color: 'text.secondary' }}>{React.cloneElement(stat.icon, { sx: { fontSize: 17 } })}<Typography variant="caption">{stat.label}</Typography></Box>
                <Typography variant="h5" sx={{ mt: .25 }}>{stat.value}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Retry</Button>} sx={{ mb: 3 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            aria-label="Search dashboards" placeholder="Search dashboards, tags, sources, or namespaces" value={search}
            onChange={event => setSearch(event.target.value)} size="small"
            sx={{ width: { xs: '100%', sm: 390 }, bgcolor: 'background.paper' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          {tags.length > 0 && <Stack direction="row" spacing={.75} sx={{ overflowX: 'auto', pb: .25 }}>
            <Chip size="small" label="All" variant={activeTag === null ? 'filled' : 'outlined'} color={activeTag === null ? 'primary' : 'default'} onClick={() => setActiveTag(null)} />
            {tags.map(tag => <Chip key={tag} size="small" label={tag} variant={activeTag === tag ? 'filled' : 'outlined'} color={activeTag === tag ? 'primary' : 'default'} onClick={() => setActiveTag(activeTag === tag ? null : tag)} />)}
          </Stack>}
          <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>{filtered.length} {filtered.length === 1 ? 'dashboard' : 'dashboards'}</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><CircularProgress size={28} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center', textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', p: 4 }}>
            <Box>
              <Box sx={{ width: 58, height: 58, borderRadius: 2.5, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}><DashboardCustomizeIcon /></Box>
              <Typography variant="h5">{dashboards.length ? 'No dashboards match' : 'Create your first dashboard'}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>{dashboards.length ? 'Try a different search or clear the active filters.' : 'Start with a blank canvas and connect your data when you are ready.'}</Typography>
              {dashboards.length ? <Button onClick={() => { setSearch(''); setActiveTag(null); setActiveSource(null); setActiveNamespace(null); }}>Clear filters</Button> : canCreate ? <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>Create dashboard</Button> : null}
            </Box>
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {filtered.map(dashboard => (
              <Grid item xs={12} sm={6} lg={4} xl={3} key={dashboard._id}>
                <Card sx={{ height: '100%', minHeight: 270, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible', transition: 'transform .18s ease, border-color .18s ease, box-shadow .18s ease', '&:hover': { transform: 'translateY(-3px)', borderColor: 'primary.main', boxShadow: theme => `0 18px 45px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,.28)' : 'rgba(20,27,38,.1)'}` } }}>
                  <Box sx={{ height: 5, bgcolor: 'primary.main', borderRadius: '10px 10px 0 0' }} />
                  <CardContent sx={{ flex: 1, p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}><DashboardCustomizeIcon fontSize="small" /></Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" noWrap>{dashboard.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(dashboard.updatedAt)}</Typography>
                      </Box>
                      <Chip label={`${dashboard.widgets.length}`} icon={<WidgetsOutlinedIcon />} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, minHeight: 42, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{dashboard.description || 'A focused workspace ready for your data story.'}</Typography>
                    <Stack direction="row" spacing={.6} sx={{ mt: 2, flexWrap: 'wrap', gap: .6 }}>
                      <Chip
                        label={dashboard.namespaceId || 'default'} size="small" color="primary"
                        variant={activeNamespace === (dashboard.namespaceId || 'default') ? 'filled' : 'outlined'}
                        onClick={() => setActiveNamespace(activeNamespace === (dashboard.namespaceId || 'default') ? null : (dashboard.namespaceId || 'default'))}
                      />
                      {(dashboard.tags || []).slice(0, 3).map(tag => <Chip key={tag} label={tag} size="small" onClick={() => setActiveTag(tag)} />)}
                      {dashboard.dataSources.map(source => (
                        <Chip
                          key={source.id} label={source.name} size="small"
                          variant={activeSource === source.name ? 'filled' : 'outlined'}
                          color={source.type === 'mongodb' ? 'success' : 'info'}
                          onClick={() => setActiveSource(activeSource === source.name ? null : source.name)}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ px: 2.5, pb: 2.25, pt: 0, gap: .5 }}>
                    <Button variant="contained" size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/view/${dashboard._id}`)}>Open</Button>
                    {(isAdmin || (user?.role === 'operator' && dashboard.ownerId === user._id)) && <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/designer/${dashboard._id}`)}>Edit</Button>}
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Export JSON"><IconButton size="small" aria-label="Export JSON" onClick={() => handleExport(dashboard)}><FileDownloadOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    {(isAdmin || (user?.role === 'operator' && dashboard.ownerId === user._id)) && <Tooltip title="Delete"><IconButton size="small" aria-label="Delete dashboard" color="error" onClick={() => handleDelete(dashboard._id!)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
