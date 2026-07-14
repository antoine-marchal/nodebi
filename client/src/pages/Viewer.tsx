import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, AppBar, Toolbar,
  Menu, MenuItem, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { dashboardApi } from '../services/api';
import { useDashboardStore } from '../store';
import DashboardGrid from '../components/Designer/DashboardGrid';
import { useAuth } from '../auth';

export default function Viewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setDashboard, setEditMode, dashboard } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin } = useAuth();
  const canEdit = isAdmin || (user?.role === 'operator' && dashboard.ownerId === user._id);

  useEffect(() => {
    if (!id) { navigate('/'); return; }
    setEditMode(false);
    setLoading(true);
    dashboardApi.get(id)
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(() => { setError('Dashboard not found'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const getCanvas = async () => {
    if (!dashboardRef.current) return Promise.reject('No ref');
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `text-align:center;font-weight:700;font-size:20px;padding:12px 0 8px 0;color:${getComputedStyle(document.body).color}`;
    titleEl.textContent = dashboard.name;
    dashboardRef.current.insertBefore(titleEl, dashboardRef.current.firstChild);
    try {
      return await html2canvas(dashboardRef.current, {
        scale: 2, useCORS: true,
        backgroundColor: getComputedStyle(dashboardRef.current).backgroundColor || '#fff',
      });
    } finally { titleEl.remove(); }
  };

  const exportPNG = async () => {
    setExportAnchor(null); setExporting(true);
    try {
      const canvas = await getCanvas();
      const link = document.createElement('a');
      link.download = `${dashboard.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally { setExporting(false); }
  };

  const exportPDF = async () => {
    setExportAnchor(null); setExporting(true);
    try {
      const canvas = await getCanvas();
      const imgData = canvas.toDataURL('image/png');
      const orientation: 'l' | 'p' = canvas.width > canvas.height ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const scale = Math.min(availW / canvas.width, availH / canvas.height);
      const drawW = canvas.width * scale;
      const drawH = canvas.height * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
      pdf.save(`${dashboard.name.replace(/\s+/g, '_')}.pdf`);
    } finally { setExporting(false); }
  };

  const exportHTML = () => {
    setExportAnchor(null);
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
    const content = dashboardRef.current?.outerHTML ?? '';
    const bgColor = getComputedStyle(document.body).backgroundColor || '#fff';
    const fgColor = getComputedStyle(document.body).color || '#000';
    const titleHTML = `<div style="text-align:center;font-weight:700;font-size:20px;padding:12px 0 8px 0;color:${fgColor}">${dashboard.name}</div>`;
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${dashboard.name}</title>${styles}
<style>body{margin:0;padding:16px;background:${bgColor}}</style>
</head><body>${titleHTML}${content}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dashboard.name.replace(/\s+/g, '_')}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')}>Dashboards</Button>
          <Typography variant="h6" sx={{ flex: 1 }}>{dashboard.name}</Typography>
          {dashboard.description && (
            <Typography variant="body2" color="text.secondary">{dashboard.description}</Typography>
          )}
          <Button startIcon={<FileDownloadIcon />} variant="outlined" disabled={exporting}
            onClick={e => setExportAnchor(e.currentTarget)}>
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
          <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
            <MenuItem onClick={exportPNG}><ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon><ListItemText>Export as PNG</ListItemText></MenuItem>
            <MenuItem onClick={exportPDF}><ListItemIcon><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText>Export as PDF</ListItemText></MenuItem>
            <Divider />
            <MenuItem onClick={exportHTML}><ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon><ListItemText>Export as HTML</ListItemText></MenuItem>
          </Menu>
          {canEdit && <Button startIcon={<EditIcon />} variant="outlined" onClick={() => { setEditMode(true); navigate(`/designer/${id}`); }}>Edit</Button>}
        </Toolbar>
      </AppBar>
      <Box ref={dashboardRef} sx={{ flex: 1, p: 2 }}>
        <DashboardGrid />
      </Box>
    </Box>
  );
}
