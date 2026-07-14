import React from 'react';
import GridLayout, { WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Box, Typography, IconButton, Tooltip, Paper, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useDashboardStore } from '../../store';
import WidgetRenderer from '../Widgets/WidgetRenderer';
import { WIDGET_DEFAULTS, WidgetType } from '../../types';

const Grid = WidthProvider(GridLayout);

export default function DashboardGrid() {
  const {
    dashboard, updateLayout, selectWidget, removeWidget, duplicateWidget,
    selectedWidgetId, isEditMode, draggedWidgetType, addWidgetAt, setDraggedWidgetType,
  } = useDashboardStore();

  const dropDefaults = draggedWidgetType ? WIDGET_DEFAULTS[draggedWidgetType] : { w: 4, h: 4, minW: 1, minH: 1 };
  const isEmpty = dashboard.widgets.length === 0;

  if (isEmpty && !isEditMode) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.disabled">No widgets configured</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100%', position: 'relative', minHeight: 420,
      border: isEmpty ? '1px dashed' : '1px solid', borderColor: 'divider', borderRadius: 2.5,
      bgcolor: 'background.paper', overflow: 'hidden',
      backgroundImage: theme => theme.palette.mode === 'light'
        ? 'radial-gradient(rgba(17,24,39,.12) .75px, transparent .75px)'
        : 'radial-gradient(rgba(255,255,255,.1) .75px, transparent .75px)',
      backgroundSize: '20px 20px',
    }}>
      {isEmpty && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, pointerEvents: 'none' }}>
          <Chip label="Blank canvas" size="small" color="primary" variant="outlined" sx={{ mb: .5 }} />
          <Typography color="text.primary" variant="h6">Build your first view</Typography>
          <Typography color="text.secondary" variant="body2">Choose a widget from the library and connect a data source.</Typography>
        </Box>
      )}
      <Grid
        layout={dashboard.layout as Layout[]}
        cols={12}
        rowHeight={60}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        isDroppable={isEditMode && !!draggedWidgetType}
        droppingItem={{ i: '__drop__', w: dropDefaults.w, h: dropDefaults.h }}
        onDrop={(_layout: Layout[], item: Layout, e: any) => {
          const t = (draggedWidgetType || (e?.dataTransfer?.getData('text/plain') as WidgetType)) as WidgetType;
          if (t) addWidgetAt(t, Math.max(0, item.x), Math.max(0, item.y));
          setDraggedWidgetType(null);
        }}
        onLayoutChange={(layout) => updateLayout(layout as any)}
        margin={[14, 14]}
        containerPadding={[12, 12]}
        draggableHandle=".drag-handle"
      >
        {dashboard.widgets.map(widget => {
          const isSelected = selectedWidgetId === widget.id;
          const hasTitle = !!widget.title;
          return (
            <div key={widget.id} style={{ display: 'flex' }}>
              <Paper
                elevation={0}
                onClick={() => isEditMode && selectWidget(widget.id)}
                sx={{
                  flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', border: 1, borderRadius: 2,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: isSelected ? '0 0 0 2px rgba(228,0,43,.18), 0 14px 30px rgba(0,0,0,.1)' : '0 8px 22px rgba(0,0,0,.06)',
                  cursor: isEditMode ? 'pointer' : 'default',
                  transition: 'border-color 0.15s, box-shadow 0.15s, transform .15s',
                  '&:hover': isEditMode ? { borderColor: 'primary.main', boxShadow: '0 12px 28px rgba(0,0,0,.1)' } : {},
                }}
              >
                {(hasTitle || isEditMode) && (
                  <Box
                    className={isEditMode ? 'drag-handle' : undefined}
                    sx={{
                      display: 'flex', justifyContent: 'flex-start', alignItems: 'center',
                      px: 1.5, pt: 1.1, pb: 0.5, flexShrink: 0, minHeight: 30,
                      cursor: isEditMode ? 'grab' : 'default', userSelect: 'none',
                      '&:active': isEditMode ? { cursor: 'grabbing' } : {},
                    }}
                  >
                    {hasTitle && (
                      <Typography variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1, color: 'text.primary' }}>
                        {widget.title}
                      </Typography>
                    )}
                  </Box>
                )}

                <Box sx={{ flex: 1, overflow: 'hidden', px: 1, pb: 1, pt: hasTitle || isEditMode ? 0 : 1, minHeight: 0 }}>
                  <WidgetRenderer widget={widget} dataSources={dashboard.dataSources} />
                </Box>

                {isEditMode && (
                  <Box
                    sx={{
                      position: 'absolute', bottom: 2, right: 22, zIndex: 3,
                      display: 'flex', gap: 0.3, opacity: 0.6, transition: 'opacity 0.15s',
                      '&:hover': { opacity: 1 },
                    }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <Tooltip title="Configure">
                      <IconButton size="small" onClick={e => { e.stopPropagation(); selectWidget(widget.id); }}
                        sx={{ p: 0.3, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                        <SettingsIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={e => { e.stopPropagation(); duplicateWidget(widget.id); }}
                        sx={{ p: 0.3, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                        <ContentCopyIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={e => { e.stopPropagation(); removeWidget(widget.id); }}
                        sx={{ p: 0.3, bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' } }}>
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Paper>
            </div>
          );
        })}
      </Grid>
    </Box>
  );
}
