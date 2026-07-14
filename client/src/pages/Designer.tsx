import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { dashboardApi } from '../services/api';
import { useDashboardStore } from '../store';
import Toolbar from '../components/Designer/Toolbar';
import WidgetPalette from '../components/Designer/WidgetPalette';
import DashboardGrid from '../components/Designer/DashboardGrid';
import WidgetConfigPanel from '../components/Designer/WidgetConfigPanel';
import GlobalFiltersBar from '../components/Designer/GlobalFiltersBar';
import { useAuth } from '../auth';

export default function Designer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    setDashboard, setEditMode, save, undo, redo,
    selectedWidgetId, removeWidget, duplicateWidget, selectWidget,
  } = useDashboardStore();
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');
  const { user, isAdmin, canCreate } = useAuth();

  useEffect(() => {
    setEditMode(true);
    if (!id) { if (!canCreate) navigate('/', { replace: true }); setLoading(false); return; }
    setLoading(true);
    dashboardApi.get(id)
      .then(d => {
        if (!isAdmin && !(user?.role === 'operator' && d.ownerId === user._id)) { navigate(`/view/${d._id}`, { replace: true }); return; }
        setDashboard(d); setLoading(false);
      })
      .catch(() => { setError('Dashboard not found'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canCreate, isAdmin, navigate, user?._id, user?.role, setDashboard, setEditMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.matches('input, textarea, [contenteditable=true]');
      if (isInput) return;

      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === 's') { e.preventDefault(); save().catch(() => {}); return; }
      if (cmd && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (cmd && (e.shiftKey && e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) { e.preventDefault(); redo(); return; }
      if (cmd && e.key.toLowerCase() === 'd' && selectedWidgetId) { e.preventDefault(); duplicateWidget(selectedWidgetId); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWidgetId) {
        e.preventDefault(); removeWidget(selectedWidgetId); return;
      }
      if (e.key === 'Escape') { selectWidget(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, undo, redo, duplicateWidget, removeWidget, selectWidget, selectedWidgetId]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Toolbar onSaved={(saved) => { if (!id && saved._id) navigate(`/designer/${saved._id}`, { replace: true }); }} />
      <GlobalFiltersBar />
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <WidgetPalette />
        <Box component="main" sx={{ flex: 1, overflow: 'auto', minWidth: 0, bgcolor: 'background.default', p: { xs: 1.5, lg: 2.5 } }}>
          <Box sx={{ maxWidth: 1600, minWidth: 680, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: .5 }}>
              <Box>
                <Typography variant="subtitle2">Dashboard canvas</Typography>
                <Typography variant="caption" color="text.secondary">Drag widgets to arrange · resize from any lower corner</Typography>
              </Box>
            </Box>
            <DashboardGrid />
          </Box>
        </Box>
        <WidgetConfigPanel />
      </Box>
    </Box>
  );
}
