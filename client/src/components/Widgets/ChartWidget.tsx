import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LabelList,
} from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';
import { ChartConfig } from '../../types';

interface Props {
  type: 'bar-chart' | 'line-chart' | 'area-chart' | 'pie-chart' | 'donut-chart' | 'scatter-chart';
  data: any[];
  config: ChartConfig;
  onDrilldown?: (field: string, value: any) => void;
}

export const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#0284c7',
];

function normalizeXY(data: any[], config: ChartConfig) {
  if (data.length > 0 && '_id' in data[0]) {
    return data.map(d => ({ label: d._id === null ? '(null)' : String(d._id), raw: d._id, value: Number(d.value) || 0 }));
  }
  return data.map(d => ({
    label: String(d[config.xField] ?? '?'),
    raw: d[config.xField],
    value: Number(d[config.yField]) || 0,
  }));
}

function normalizeScatter(data: any[], config: ChartConfig) {
  return data.map(d => ({
    x: Number(d[config.xField]) || 0,
    y: Number(d[config.yField]) || 0,
  }));
}

function renderPieLabel({ cx, cy, midAngle, outerRadius, name, value, percent }: any) {
  if (percent < 0.04) return null;
  const RAD = Math.PI / 180;
  const r = outerRadius * 1.18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
      <tspan fontWeight="600">{name}</tspan>
      <tspan>  {Number(value).toLocaleString()}</tspan>
      <tspan fill="#94a3b8"> ({(percent * 100).toFixed(1)}%)</tspan>
    </text>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: item } = payload[0];
  const pct = typeof item.percent === 'number' ? item.percent : 0;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}>
      <Typography variant="caption" fontWeight={700}>{name}</Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 0.3 }}>
        <Typography variant="caption">Value: <b>{Number(value).toLocaleString()}</b></Typography>
        <Typography variant="caption" color="text.secondary">({(pct * 100).toFixed(1)}%)</Typography>
      </Box>
    </Box>
  );
}

export default function ChartWidget({ type, data, config, onDrilldown }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const tooltipBg = theme.palette.background.paper;
  const tooltipBorder = theme.palette.divider;
  const color = config.color || CHART_COLORS[0];

  const tooltipStyle = {
    contentStyle: {
      background: tooltipBg,
      border: `1px solid ${tooltipBorder}`,
      borderRadius: 8,
      fontSize: 12,
      fontFamily: 'Inter, sans-serif',
    },
    labelStyle: { fontWeight: 600 },
  };

  const handleClick = (entry: any) => {
    if (!onDrilldown) return;
    const field = config.xField;
    const value = entry?.payload?.raw ?? entry?.payload?.label ?? entry?.raw ?? entry?.label;
    if (field && value !== undefined) onDrilldown(field, value);
  };

  if (!data.length) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.disabled" variant="caption">No data</Typography>
      </Box>
    );
  }

  if (type === 'pie-chart' || type === 'donut-chart') {
    const normalized = normalizeXY(data, config);
    const totalSum = normalized.reduce((s, d) => s + d.value, 0);
    const withPercent = normalized.map(n => ({ ...n, percent: totalSum > 0 ? n.value / totalSum : 0 }));
    const innerR = type === 'donut-chart' ? '45%' : '0%';

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={withPercent}
              dataKey="value"
              nameKey="label"
              cx="50%" cy="50%"
              outerRadius="65%"
              innerRadius={innerR}
              label={renderPieLabel}
              labelLine={{ stroke: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', strokeWidth: 1 }}
              paddingAngle={2}
              onClick={(entry: any) => onDrilldown && config.xField && onDrilldown(config.xField, entry?.raw ?? entry?.label)}
            >
              {withPercent.map((_e, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" cursor={onDrilldown ? 'pointer' : 'default'} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            {config.showLegend && <Legend verticalAlign="bottom" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
          </PieChart>
        </ResponsiveContainer>
        {type === 'donut-chart' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="subtitle2" fontWeight={700}>{Number(totalSum).toLocaleString()}</Typography>
          </Box>
        )}
      </Box>
    );
  }

  if (type === 'scatter-chart') {
    const scatterData = normalizeScatter(data, config);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis type="number" dataKey="x" name={config.xField} tick={{ fill: tickColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => Number(v).toLocaleString()} />
          <YAxis type="number" dataKey="y" name={config.yField} tick={{ fill: tickColor, fontSize: 11 }} tickLine={false} axisLine={false} width={42} tickFormatter={v => Number(v).toLocaleString()} />
          <ZAxis range={[30, 30]} />
          <Tooltip {...tooltipStyle} formatter={(v: any, n: string) => [Number(v).toLocaleString(), n]} />
          {config.showLegend && <Legend verticalAlign="bottom" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
          <Scatter data={scatterData} fill={color} opacity={0.75} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const normalized = normalizeXY(data, config);
  const margin = { top: config.showLabels ? 20 : 8, right: 12, left: 0, bottom: 4 };
  const cursor = onDrilldown ? 'pointer' : 'default';

  const commonAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
      <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis tick={{ fill: tickColor, fontSize: 11 }} tickLine={false} axisLine={false} width={46} tickFormatter={v => Number(v).toLocaleString()} />
      <Tooltip {...tooltipStyle} formatter={(v: any) => [Number(v).toLocaleString(), config.yField || 'Value']} />
      {config.showLegend && <Legend verticalAlign="bottom" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (type === 'line-chart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalized} margin={margin} onClick={(e: any) => e?.activePayload?.[0] && handleClick(e.activePayload[0])}>
          {commonAxis}
          <Line type="monotone" dataKey="value" name={config.yField || 'Value'} stroke={color} strokeWidth={2.5}
            dot={{ r: 3, fill: color, strokeWidth: 0, cursor }} activeDot={{ r: 5, strokeWidth: 0 }}>
            {config.showLabels && (
              <LabelList dataKey="value" position="top" style={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }} formatter={(v: any) => Number(v).toLocaleString()} />
            )}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area-chart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={normalized} margin={margin} onClick={(e: any) => e?.activePayload?.[0] && handleClick(e.activePayload[0])}>
          <defs>
            <linearGradient id={`areaGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stopColor={color} stopOpacity={0.3} />
              <stop offset="90%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {commonAxis}
          <Area type="monotone" dataKey="value" name={config.yField || 'Value'} stroke={color} strokeWidth={2.5}
            fill={`url(#areaGrad-${color.replace('#', '')})`} dot={{ r: 3, fill: color, strokeWidth: 0 }}>
            {config.showLabels && (
              <LabelList dataKey="value" position="top" style={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }} formatter={(v: any) => Number(v).toLocaleString()} />
            )}
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={normalized} margin={margin} onClick={(e: any) => e?.activePayload?.[0] && handleClick(e.activePayload[0])}>
        {commonAxis}
        <Bar dataKey="value" name={config.yField || 'Value'} fill={color} radius={[3, 3, 0, 0]} cursor={cursor}>
          {config.showLabels && (
            <LabelList dataKey="value" position="top" style={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }} formatter={(v: any) => Number(v).toLocaleString()} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
