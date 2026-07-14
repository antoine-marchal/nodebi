import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { GaugeConfig } from '../../types';

interface Props {
  data: any[];
  config: GaugeConfig;
}

function formatGaugeValue(val: number, unit?: string): string {
  const formatted = Math.abs(val) >= 1000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(val)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  return unit ? `${formatted} ${unit}` : formatted;
}

export default function GaugeWidget({ data, config }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const raw = data[0]?.value ?? 0;
  const value = Number(raw) || 0;
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const clamped = Math.min(max, Math.max(min, value));
  const pct = (clamped - min) / (max - min); // 0..1

  // Gauge arc: 230° sweep, centred at bottom
  const START_ANGLE = 215; // degrees clockwise from top
  const SWEEP = 250;       // total arc in degrees
  const endAngle = START_ANGLE + SWEEP * pct;

  // SVG sizes
  const CX = 50, CY = 58, R_OUTER = 38, R_INNER = 26;

  function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const toRad = (d: number) => (d - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  // Colour: explicit accent overrides zone-based default
  const gaugeColor = config.accentColor || (
    pct < 0.33 ? theme.palette.success.main
    : pct < 0.66 ? theme.palette.warning.main
    : theme.palette.error.main
  );

  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textFill = theme.palette.text.primary;
  const subFill = theme.palette.text.secondary;
  const endArcAngle = Math.max(START_ANGLE + 0.5, endAngle); // avoid zero-length arc

  // Compute min/max label positions just outside the arc endpoints
  const LABEL_R = R_OUTER + 5;
  const toRadLabel = (d: number) => (d - 90) * (Math.PI / 180);
  const minLX = CX + LABEL_R * Math.cos(toRadLabel(START_ANGLE));
  const minLY = CY + LABEL_R * Math.sin(toRadLabel(START_ANGLE));
  const maxLX = CX + LABEL_R * Math.cos(toRadLabel(START_ANGLE + SWEEP));
  const maxLY = CY + LABEL_R * Math.sin(toRadLabel(START_ANGLE + SWEEP));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 0.5 }}>
      <Box sx={{ width: '100%', maxWidth: 200, flex: 1, display: 'flex', alignItems: 'center' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', overflow: 'visible' }}>
          {/* Track arc */}
          <path
            d={arc(CX, CY, (R_OUTER + R_INNER) / 2, START_ANGLE, START_ANGLE + SWEEP)}
            fill="none"
            stroke={trackColor}
            strokeWidth={R_OUTER - R_INNER}
            strokeLinecap="round"
          />
          {/* Value arc */}
          {pct > 0 && (
            <path
              d={arc(CX, CY, (R_OUTER + R_INNER) / 2, START_ANGLE, endArcAngle)}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={R_OUTER - R_INNER}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px currentColor)', transition: 'all 0.5s ease' }}
            />
          )}
          {/* Centre text: value */}
          <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle" fill={textFill} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">
            {formatGaugeValue(value, config.unit)}
          </text>
          {/* Min / max labels at arc endpoints */}
          <text x={minLX} y={minLY} textAnchor="middle" dominantBaseline="middle" fill={subFill} fontSize="5.5" fontFamily="Inter, sans-serif">{config.min ?? 0}</text>
          <text x={maxLX} y={maxLY} textAnchor="middle" dominantBaseline="middle" fill={subFill} fontSize="5.5" fontFamily="Inter, sans-serif">{config.max ?? 100}</text>
        </svg>
      </Box>
      {config.label && (
        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>
          {config.label}
        </Typography>
      )}
    </Box>
  );
}
