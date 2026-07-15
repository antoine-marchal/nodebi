import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ProductMark({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box aria-hidden sx={{ width: 30, height: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', flexShrink: 0 }}>
        {[0, 1, 2, 3].map(i => <Box key={i} sx={{ bgcolor: i === 1 ? 'primary.light' : 'primary.main', borderRadius: i === 0 || i === 3 ? '4px 1px' : '1px 4px' }} />)}
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.025em' }}>NodeBI</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>Decision workspace · v{__APP_VERSION__}</Typography>
        </Box>
      )}
    </Box>
  );
}
