import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, AppBar, Toolbar, CircularProgress, Alert, Chip } from '@mui/material';
import { shareApi } from '../services/api';
import { useDashboardStore } from '../store';
import DashboardGrid from '../components/Designer/DashboardGrid';

export default function SharedView() {
  const { token } = useParams<{ token: string }>();
  const { setDashboard, setEditMode, setShareToken, dashboard } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('Missing token'); setLoading(false); return; }
    setEditMode(false);
    setShareToken(token);
    shareApi.getDashboard(token)
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.error || 'Invalid or expired link'); setLoading(false); });
    return () => setShareToken(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>{dashboard.name}</Typography>
          <Chip label="Read-only shared view" size="small" variant="outlined" />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, p: 2 }}>
        <DashboardGrid />
      </Box>
    </Box>
  );
}
