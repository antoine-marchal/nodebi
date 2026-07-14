import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, CircularProgress, Typography, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ChartGroupConfig, ChartItem, DataSource } from '../../types';
import { fetchChartData, QueryContext } from '../../services/widgetData';
import { useDashboardStore } from '../../store';
import ChartWidget from './ChartWidget';

function SubChart({ item, ctx }: { item: ChartItem; ctx: QueryContext }) {
  const applyDrilldown = useDashboardStore(s => s.applyDrilldown);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cfg = item.config;
  const isConfigured = !!cfg.dataSourceId && !!cfg.collection;

  const fetchData = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true); setError('');
    try {
      const result = await fetchChartData(item.type, cfg, ctx);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }, [item.type, cfg, ctx, isConfigured]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const center = (children: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 0.5 }}>
      {children}
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {item.title && (
        <Typography variant="caption" fontWeight={700} textAlign="center" noWrap sx={{ pb: 0.5, flexShrink: 0 }}>
          {item.title}
        </Typography>
      )}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {!isConfigured && center(<Typography color="text.disabled" variant="caption">Configure data source</Typography>)}
        {isConfigured && loading && center(<CircularProgress size={20} />)}
        {isConfigured && !loading && error && center(
          <>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 22 }} />
            <Typography color="error" variant="caption" textAlign="center" sx={{ px: 1 }}>{error}</Typography>
            <Tooltip title="Retry"><IconButton size="small" onClick={fetchData}><RefreshIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
          </>
        )}
        {isConfigured && !loading && !error && (
          <ChartWidget type={item.type} data={data} config={cfg} onDrilldown={(f, v) => applyDrilldown(f, v)} />
        )}
      </Box>
    </Box>
  );
}

interface Props {
  config: ChartGroupConfig;
  dataSources: DataSource[];
}

export default function ChartGroupWidget({ config, dataSources }: Props) {
  const shareToken = useDashboardStore(s => s.shareToken);
  const globalFilters = useDashboardStore(s => s.dashboard.globalFilters);
  const dashboardId = useDashboardStore(s => s.dashboard._id);
  const ctx: QueryContext = useMemo(() => ({ dataSources, dashboardId, shareToken, globalFilters }), [dataSources, dashboardId, shareToken, globalFilters]);

  const items = config.items || [];
  const cols = Math.max(1, config.columns || 2);

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.disabled" variant="caption">Add charts in the config panel</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1, height: '100%', overflow: 'auto' }}>
      {items.map(item => (
        <Box key={item.id} sx={{
          minHeight: 180, border: 1, borderColor: 'divider', borderRadius: 1, p: 1, overflow: 'hidden', bgcolor: 'background.paper',
        }}>
          <SubChart item={item} ctx={ctx} />
        </Box>
      ))}
    </Box>
  );
}
