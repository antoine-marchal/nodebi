import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { KPIConfig } from '../../types';

interface Props {
  data: any[];
  config: KPIConfig;
}

function formatValue(val: number, format: KPIConfig['format'], prefix?: string, suffix?: string): string {
  let str = '';
  if (format === 'currency') {
    str = Math.abs(val) >= 1e6
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val)
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  } else if (format === 'percentage') {
    str = `${val.toFixed(1)}%`;
  } else {
    str = Math.abs(val) >= 1e6
      ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val)
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  }
  return `${prefix || ''}${str}${suffix || ''}`;
}

export default function KPIWidget({ data, config }: Props) {
  const theme = useTheme();
  const raw = data[0]?.value ?? (data.length > 0 ? data.length : 0);
  const value = Number(raw) || 0;
  const formatted = formatValue(value, config.format, config.prefix, config.suffix);
  const accent = config.accentColor || theme.palette.primary.main;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 0.5, textAlign: 'center', px: 1,
    }}>
      <Typography
        fontWeight={800}
        sx={{
          fontSize: 'clamp(1.4rem, 4vw, 2.4rem)',
          lineHeight: 1,
          color: accent,
          letterSpacing: '-0.02em',
        }}
      >
        {formatted}
      </Typography>
      {config.label && (
        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mt: 0.5, fontSize: 11 }}>
          {config.label.toUpperCase()}
        </Typography>
      )}
      <Box sx={{ width: 32, height: 2, bgcolor: accent, borderRadius: 1, opacity: 0.4, mt: 0.5 }} />
    </Box>
  );
}
