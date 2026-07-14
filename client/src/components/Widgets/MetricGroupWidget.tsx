import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, CircularProgress, Typography, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { MetricGroupConfig, MetricItem, KPIConfig, StatCardConfig, GaugeConfig, DataSource } from '../../types';
import { fetchMetricData, QueryContext } from '../../services/widgetData';
import { useDashboardStore } from '../../store';
import KPIWidget from './KPIWidget';
import StatCardWidget from './StatCardWidget';
import GaugeWidget from './GaugeWidget';

function SubMetric({ item, ctx }: { item: MetricItem; ctx: QueryContext }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cfg = item.config as any;
  const isConfigured = !!cfg.dataSourceId && !!cfg.collection;

  const fetchData = useCallback(async () => {
    if (!isConfigured) return;
    setLoading(true); setError('');
    try {
      const result = await fetchMetricData(item.config, ctx);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }, [item, ctx, isConfigured]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const center = (children: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
      {children}
    </Box>
  );

  if (!isConfigured) return center(<Typography color="text.disabled" variant="caption" textAlign="center">Not configured</Typography>);
  if (loading) return center(<CircularProgress size={18} />);
  if (error) return center(
    <>
      <ErrorOutlineIcon color="error" sx={{ fontSize: 22 }} />
      <Typography color="error" variant="caption" textAlign="center" sx={{ lineHeight: 1.2 }}>{error}</Typography>
      <Tooltip title="Retry"><IconButton size="small" onClick={fetchData}><RefreshIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
    </>
  );

  if (item.type === 'kpi') return <KPIWidget data={data} config={item.config as KPIConfig} />;
  if (item.type === 'stat-card') return <StatCardWidget data={data} config={item.config as StatCardConfig} />;
  if (item.type === 'gauge') return <GaugeWidget data={data} config={item.config as GaugeConfig} />;
  return null;
}

interface Props {
  config: MetricGroupConfig;
  dataSources: DataSource[];
}

export default function MetricGroupWidget({ config, dataSources }: Props) {
  const shareToken = useDashboardStore(s => s.shareToken);
  const globalFilters = useDashboardStore(s => s.dashboard.globalFilters);
  const dashboardId = useDashboardStore(s => s.dashboard._id);
  const ctx: QueryContext = useMemo(() => ({ dataSources, dashboardId, shareToken, globalFilters }), [dataSources, dashboardId, shareToken, globalFilters]);

  const items = config.items || [];
  const cols = Math.max(1, config.columns || 3);

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.disabled" variant="caption">Add metrics in the config panel</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 1, height: '100%', overflow: 'auto', alignContent: 'start',
    }}>
      {items.map(item => (
        <Box key={item.id} sx={{
          minHeight: 80, border: 1, borderColor: 'divider', borderRadius: 1,
          overflow: 'hidden', bgcolor: 'background.paper',
        }}>
          <SubMetric item={item} ctx={ctx} />
        </Box>
      ))}
    </Box>
  );
}
