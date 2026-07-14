import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { WidgetType } from '../../types';

interface Props {
  type: WidgetType;
}

export default function WidgetSkeleton({ type }: Props) {
  if (type === 'kpi' || type === 'stat-card') {
    return (
      <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
        <Skeleton variant="text" width="60%" height={38} />
        <Skeleton variant="text" width="40%" height={14} />
      </Box>
    );
  }
  if (type === 'gauge') {
    return (
      <Box sx={{ p: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton variant="circular" width={120} height={120} />
      </Box>
    );
  }
  if (type === 'table') {
    return (
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={22} />
        ))}
      </Box>
    );
  }
  // chart-ish
  return (
    <Box sx={{ p: 1, height: '100%', display: 'flex', alignItems: 'flex-end', gap: 1 }}>
      {[40, 75, 50, 90, 60, 70, 45, 85].map((h, i) => (
        <Skeleton key={i} variant="rectangular" sx={{ flex: 1, height: `${h}%` }} />
      ))}
    </Box>
  );
}
