import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { StatCardConfig } from '../../types';

interface Props {
  data: any[];
  config: StatCardConfig;
}

function formatValue(val: number, format: StatCardConfig['format'], prefix?: string, suffix?: string): string {
  let str = '';
  if (format === 'currency') {
    str = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: val >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: val >= 1e6 ? 1 : 0 }).format(val);
  } else if (format === 'percentage') {
    str = `${val.toFixed(1)}%`;
  } else {
    str = Math.abs(val) >= 1e6
      ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val)
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  }
  return `${prefix || ''}${str}${suffix || ''}`;
}

export default function StatCardWidget({ data, config }: Props) {
  const theme = useTheme();

  const raw = data[0]?.value ?? (data.length > 0 ? data.length : 0);
  const value = Number(raw) || 0;

  const colorKey = config.colorScheme || 'primary';
  const paletteMain = (theme.palette as any)[colorKey]?.main ?? theme.palette.primary.main;
  const paletteLight = (theme.palette as any)[colorKey]?.light ?? paletteMain;
  const accentColor = config.accentColor || paletteMain;
  const lightColor = config.accentColor || paletteLight;

  return (
    <Box sx={{
      display: 'flex', height: '100%', borderRadius: 1, overflow: 'hidden',
      border: 1, borderColor: 'divider', position: 'relative',
    }}>
      {/* Left accent bar */}
      <Box sx={{ width: 4, bgcolor: accentColor, flexShrink: 0 }} />

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1.5, py: 1, gap: 1.5, minWidth: 0 }}>
        {/* Icon */}
        {config.icon && (
          <Box sx={{ fontSize: 28, lineHeight: 1, flexShrink: 0, opacity: 0.85 }}>
            {config.icon}
          </Box>
        )}

        {/* Value + labels */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ color: lightColor, lineHeight: 1.1, mb: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {formatValue(value, config.format, config.prefix, config.suffix)}
          </Typography>
          {config.label && (
            <Typography variant="caption" fontWeight={600} color="text.secondary" noWrap sx={{ display: 'block' }}>
              {config.label}
            </Typography>
          )}
          {config.description && (
            <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block', fontSize: 10 }}>
              {config.description}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Subtle background tint */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(135deg, ${accentColor}08 0%, transparent 60%)`,
      }} />
    </Box>
  );
}
