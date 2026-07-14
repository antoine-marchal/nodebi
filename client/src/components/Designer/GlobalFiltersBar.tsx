import React, { useState } from 'react';
import { Box, TextField, IconButton, Chip, Typography, Collapse, Button } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import { useDashboardStore } from '../../store';
import { GlobalFilters } from '../../types';

export default function GlobalFiltersBar() {
  const { dashboard, setGlobalFilters, clearDrilldown } = useDashboardStore();
  const filters: GlobalFilters = dashboard.globalFilters || {};
  const [expanded, setExpanded] = useState(!!(filters.dateField || filters.dateFrom || filters.dateTo));

  const set = (patch: Partial<GlobalFilters>) => setGlobalFilters({ ...filters, ...patch });

  const drilldown = filters.search ? (() => { try { return JSON.parse(filters.search); } catch { return null; } })() : null;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 2, py: expanded ? 1 : 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setExpanded(e => !e)}>
          <FilterListIcon fontSize="small" />
        </IconButton>
        <Typography variant="caption" color="text.secondary">Global filters</Typography>

        {drilldown && (
          <Chip
            size="small"
            label={`drill: ${Object.entries(drilldown).map(([k, v]) => `${k}=${v}`).join(', ')}`}
            onDelete={clearDrilldown}
            color="warning"
            variant="outlined"
          />
        )}

        {(filters.dateField || filters.dateFrom || filters.dateTo) && !expanded && (
          <Chip
            size="small"
            label={`${filters.dateField || '?'}: ${filters.dateFrom || '...'} → ${filters.dateTo || '...'}`}
            onDelete={() => setGlobalFilters({})}
            variant="outlined"
          />
        )}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Date field"
            size="small"
            value={filters.dateField || ''}
            onChange={e => set({ dateField: e.target.value })}
            placeholder="createdAt"
            sx={{ width: 160 }}
          />
          <TextField
            label="From"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.dateFrom || ''}
            onChange={e => set({ dateFrom: e.target.value })}
          />
          <TextField
            label="To"
            size="small"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={filters.dateTo || ''}
            onChange={e => set({ dateTo: e.target.value })}
          />
          <Button size="small" startIcon={<ClearIcon />} onClick={() => setGlobalFilters({})}>
            Clear
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
