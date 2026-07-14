import React from 'react';
import { Box, ButtonBase, Chip, Paper, Tooltip, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import GridViewIcon from '@mui/icons-material/GridView';
import PieChartIcon from '@mui/icons-material/PieChart';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SpeedIcon from '@mui/icons-material/Speed';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import StraightenIcon from '@mui/icons-material/Straighten';
import TableChartIcon from '@mui/icons-material/TableChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { useDashboardStore } from '../../store';
import { WidgetType } from '../../types';

const PALETTE: { type: WidgetType; label: string; icon: React.ReactNode; desc: string; group: string }[] = [
  { group: 'Charts', type: 'bar-chart', label: 'Bar', icon: <BarChartIcon />, desc: 'Compare categories' },
  { group: 'Charts', type: 'line-chart', label: 'Line', icon: <ShowChartIcon />, desc: 'Show trends over time' },
  { group: 'Charts', type: 'area-chart', label: 'Area', icon: <StackedLineChartIcon />, desc: 'Emphasize volume' },
  { group: 'Charts', type: 'pie-chart', label: 'Pie', icon: <PieChartIcon />, desc: 'Show proportions' },
  { group: 'Charts', type: 'donut-chart', label: 'Donut', icon: <DonutLargeIcon />, desc: 'Proportions with a total' },
  { group: 'Charts', type: 'scatter-chart', label: 'Scatter', icon: <ScatterPlotIcon />, desc: 'Correlate numeric fields' },
  { group: 'Charts', type: 'chart-group', label: 'Chart group', icon: <GridViewIcon />, desc: 'Combine multiple charts' },
  { group: 'Data', type: 'table', label: 'Table', icon: <TableChartIcon />, desc: 'Explore records in rows' },
  { group: 'Metrics', type: 'kpi', label: 'KPI', icon: <SpeedIcon />, desc: 'Highlight one metric' },
  { group: 'Metrics', type: 'stat-card', label: 'Stat card', icon: <DashboardIcon />, desc: 'Metric with context' },
  { group: 'Metrics', type: 'gauge', label: 'Gauge', icon: <StraightenIcon />, desc: 'Show progress in a range' },
  { group: 'Metrics', type: 'metric-group', label: 'Metric group', icon: <GridViewIcon />, desc: 'Combine multiple metrics' },
  { group: 'Content', type: 'text', label: 'Text', icon: <TextFieldsIcon />, desc: 'Add Markdown context' },
];

export default function WidgetPalette() {
  const { addWidget, dashboard, isEditMode, setDraggedWidgetType } = useDashboardStore();
  if (!isEditMode) return null;

  const onDragStart = (type: WidgetType, event: React.DragEvent) => {
    setDraggedWidgetType(type);
    event.dataTransfer.setData('text/plain', type);
    event.dataTransfer.effectAllowed = 'copy';
    (event.currentTarget as HTMLElement).classList.add('droppable-element');
  };

  return (
    <Paper component="aside" square elevation={0} sx={{ width: 214, flexShrink: 0, borderRight: 1, borderColor: 'divider', display: { xs: 'none', md: 'flex' }, flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Add a widget</Typography>
          <Chip size="small" label={dashboard.widgets.length} variant="outlined" />
        </Box>
        <Typography variant="caption" color="text.secondary">Click to add or drag onto the canvas</Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.25 }}>
        {['Charts', 'Data', 'Metrics', 'Content'].map(group => (
          <Box key={group} sx={{ mb: 1.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: .75, fontSize: 10, lineHeight: 2.5, letterSpacing: '.1em' }}>{group}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: .75 }}>
              {PALETTE.filter(item => item.group === group).map(item => (
                <Tooltip key={item.type} title={item.desc} placement="right" arrow>
                  <ButtonBase
                    className="droppable-element" draggable
                    onDragStart={event => onDragStart(item.type, event)} onDragEnd={() => setDraggedWidgetType(null)}
                    onClick={() => addWidget(item.type)}
                    sx={{ minHeight: 66, p: 1, border: 1, borderColor: 'divider', borderRadius: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: .7, textAlign: 'left', color: 'text.secondary', transition: 'all .15s ease', '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.selected', transform: 'translateY(-1px)' }, '&:hover .drag-indicator': { opacity: 1 } }}
                  >
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {React.cloneElement(item.icon as React.ReactElement, { sx: { fontSize: 20 } })}
                      <DragIndicatorIcon className="drag-indicator" sx={{ fontSize: 14, opacity: 0, transition: 'opacity .15s' }} />
                    </Box>
                    <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.15 }}>{item.label}</Typography>
                  </ButtonBase>
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Typography variant="caption" color="text.secondary">Tip: select a widget to edit its data and appearance.</Typography>
      </Box>
    </Paper>
  );
}
