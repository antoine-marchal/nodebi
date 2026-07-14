import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Widget, DataSource, ChartConfig, TableConfig, KPIConfig, GaugeConfig, StatCardConfig, TextConfig,
  MetricGroupConfig, ChartGroupConfig, GlobalFilters, isChartType, isMetricType,
} from '../../types';
import { fetchChartData, fetchMetricData, fetchTableData, QueryContext } from '../../services/widgetData';
import ChartWidget from './ChartWidget';
import TableWidget from './TableWidget';
import KPIWidget from './KPIWidget';
import TextWidget from './TextWidget';
import GaugeWidget from './GaugeWidget';
import StatCardWidget from './StatCardWidget';
import MetricGroupWidget from './MetricGroupWidget';
import ChartGroupWidget from './ChartGroupWidget';
import WidgetSkeleton from '../common/WidgetSkeleton';
import { useDashboardStore } from '../../store';

interface Props {
  widget: Widget;
  dataSources: DataSource[];
}

function configFingerprint(widget: Widget, gf?: GlobalFilters): string {
  const cfg = widget.config as any;
  // Capture only fields that influence query results
  return JSON.stringify({
    t: widget.type,
    ds: cfg.dataSourceId,
    col: cfg.collection,
    qf: cfg.queryFilter,
    p: cfg.usePipeline ? cfg.pipeline : null,
    xf: cfg.xField, yf: cfg.yField, vf: cfg.valueField, ag: cfg.aggregation,
    lim: cfg.limit,
    gf,
  });
}

export default function WidgetRenderer({ widget, dataSources }: Props) {
  const shareToken = useDashboardStore(s => s.shareToken);
  const globalFilters = useDashboardStore(s => s.dashboard.globalFilters);
  const applyDrilldown = useDashboardStore(s => s.applyDrilldown);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [firstLoad, setFirstLoad] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dashboardId = useDashboardStore(s => s.dashboard._id);
  const ctx: QueryContext = useMemo(() => ({ dataSources, dashboardId, shareToken, globalFilters }), [dataSources, dashboardId, shareToken, globalFilters]);

  const fingerprint = useMemo(() => configFingerprint(widget, globalFilters), [widget, globalFilters]);

  const runFetch = async () => {
    const cfg = widget.config as any;
    if (widget.type === 'text' || widget.type === 'metric-group' || widget.type === 'chart-group') return;
    if (!cfg.dataSourceId || !cfg.collection) return;
    if (!shareToken && !dataSources.find(d => d.id === cfg.dataSourceId)) {
      setError('Data source not found');
      return;
    }
    setLoading(true); setError('');
    try {
      let result: any[];
      if (isChartType(widget.type)) {
        result = await fetchChartData(widget.type as any, cfg as ChartConfig, ctx);
      } else if (isMetricType(widget.type)) {
        result = await fetchMetricData(cfg, ctx);
      } else if (widget.type === 'table') {
        result = await fetchTableData(cfg as TableConfig, ctx);
      } else {
        result = [];
      }
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  // Debounced fetch on fingerprint change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { runFetch(); }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  // Auto-refresh interval
  useEffect(() => {
    if (!widget.refreshIntervalSec || widget.refreshIntervalSec < 5) return;
    const h = setInterval(() => { runFetch(); }, widget.refreshIntervalSec * 1000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.refreshIntervalSec, fingerprint]);

  if (widget.type === 'text') return <TextWidget config={widget.config as TextConfig} />;
  if (widget.type === 'metric-group') return <MetricGroupWidget config={widget.config as MetricGroupConfig} dataSources={dataSources} />;
  if (widget.type === 'chart-group') return <ChartGroupWidget config={widget.config as ChartGroupConfig} dataSources={dataSources} />;

  const cfg = widget.config as any;
  const notConfigured = !cfg.dataSourceId || !cfg.collection;

  if (loading && firstLoad) return <WidgetSkeleton type={widget.type} />;

  if (error) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1, p: 1 }}>
      <Typography color="error" variant="caption" textAlign="center">{error}</Typography>
      <Tooltip title="Retry">
        <IconButton size="small" onClick={runFetch}><RefreshIcon fontSize="small" /></IconButton>
      </Tooltip>
    </Box>
  );

  if (notConfigured) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Typography color="text.disabled" variant="caption" textAlign="center">Configure data source &amp; collection</Typography>
    </Box>
  );

  if (isChartType(widget.type)) {
    return <ChartWidget type={widget.type as any} data={data} config={cfg as ChartConfig} onDrilldown={(field, value) => applyDrilldown(field, value)} />;
  }
  if (widget.type === 'table') return <TableWidget data={data} config={cfg as TableConfig} />;
  if (widget.type === 'kpi') return <KPIWidget data={data} config={cfg as KPIConfig} />;
  if (widget.type === 'stat-card') return <StatCardWidget data={data} config={cfg as StatCardConfig} />;
  if (widget.type === 'gauge') return <GaugeWidget data={data} config={cfg as GaugeConfig} />;
  return null;
}
