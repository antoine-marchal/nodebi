import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, InputAdornment, IconButton, Tooltip,
  Pagination, Stack, Menu, MenuItem, FormControlLabel, Checkbox,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { TableConfig } from '../../types';

interface Props {
  data: any[];
  config: TableConfig;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000];

function cellToDisplay(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

interface CellCoord { r: number; c: number; }

export default function TableWidget({ data, config }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [orderBy, setOrderBy] = useState<string | null>(null);
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [anchor, setAnchor] = useState<CellCoord | null>(null);
  const [focus, setFocus] = useState<CellCoord | null>(null);
  const [dragging, setDragging] = useState(false);
  const [colsMenuEl, setColsMenuEl] = useState<HTMLElement | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const allCols = useMemo(() => {
    if (config.columns && typeof config.columns === 'string') {
      const c = config.columns.split(',').map(x => x.trim()).filter(Boolean);
      if (c.length) return c;
    }
    return data[0] ? Object.keys(data[0]).filter(k => k !== '__v') : [];
  }, [config.columns, data]);

  const cols = useMemo(() => allCols.filter(c => !hiddenCols.has(c)), [allCols, hiddenCols]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row => cols.some(c => cellToDisplay(row[c]).toLowerCase().includes(q)));
  }, [data, cols, search]);

  const sorted = useMemo(() => {
    if (!orderBy) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[orderBy]; const bv = b[orderBy];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : 1;
      return orderDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, orderBy, orderDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize]);

  const toggleSort = (col: string) => {
    if (orderBy === col) setOrderDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrderBy(col); setOrderDir('asc'); }
  };

  // ----------- range selection -----------
  const selRect = useMemo(() => {
    if (!anchor || !focus) return null;
    return {
      r0: Math.min(anchor.r, focus.r), r1: Math.max(anchor.r, focus.r),
      c0: Math.min(anchor.c, focus.c), c1: Math.max(anchor.c, focus.c),
    };
  }, [anchor, focus]);

  const inSel = (r: number, c: number) => !!selRect && r >= selRect.r0 && r <= selRect.r1 && c >= selRect.c0 && c <= selRect.c1;

  const onCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    // Mouse selection prevents the browser's default focus change below, so
    // focus the widget explicitly to ensure keyboard shortcuts reach it.
    containerRef.current?.focus({ preventScroll: true });
    if (e.shiftKey && anchor) {
      setFocus({ r, c });
    } else {
      setAnchor({ r, c });
      setFocus({ r, c });
    }
    setDragging(true);
    e.preventDefault();
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (dragging) setFocus({ r, c });
  };

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const copySelection = useCallback(async () => {
    if (!selRect) return;
    const rows: string[] = [];
    for (let r = selRect.r0; r <= selRect.r1; r++) {
      const row = slice[r]; if (!row) continue;
      const cells: string[] = [];
      for (let c = selRect.c0; c <= selRect.c1; c++) {
        const v = cellToDisplay(row[cols[c]]);
        // Escape tabs/newlines so Excel paste stays in one cell
        cells.push(v.replace(/\t/g, ' ').replace(/\r?\n/g, ' '));
      }
      rows.push(cells.join('\t'));
    }
    const tsv = rows.join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = tsv; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }
  }, [selRect, slice, cols]);

  // keyboard: Ctrl+C copy, arrows move focus, Shift+arrow extend, Ctrl+A all
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === 'c') { copySelection(); e.preventDefault(); return; }
      if (cmd && e.key.toLowerCase() === 'a') {
        setAnchor({ r: 0, c: 0 });
        setFocus({ r: slice.length - 1, c: cols.length - 1 });
        e.preventDefault(); return;
      }
      if (!focus) return;
      let { r, c } = focus;
      let handled = true;
      if (e.key === 'ArrowDown') r = Math.min(slice.length - 1, r + 1);
      else if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      else if (e.key === 'ArrowRight') c = Math.min(cols.length - 1, c + 1);
      else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      else if (e.key === 'Home') c = 0;
      else if (e.key === 'End') c = cols.length - 1;
      else handled = false;
      if (handled) {
        if (!e.shiftKey) setAnchor({ r, c });
        setFocus({ r, c });
        e.preventDefault();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [focus, slice.length, cols.length, copySelection]);

  // Reset selection when page/sort/filter changes
  useEffect(() => { setAnchor(null); setFocus(null); }, [safePage, orderBy, orderDir, search]);

  if (!data.length) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.disabled" variant="caption">No data</Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      sx={{
        height: '100%', display: 'flex', flexDirection: 'column', gap: 0.5,
        minHeight: 0, outline: 'none',
        '&:focus-visible': { outline: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <TextField placeholder="Filter…" size="small" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 220 }} />
        <Tooltip title="Columns">
          <IconButton size="small" onClick={e => setColsMenuEl(e.currentTarget)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={colsMenuEl} open={!!colsMenuEl} onClose={() => setColsMenuEl(null)}>
          {allCols.map(c => (
            <MenuItem key={c} dense onClick={() => {
              setHiddenCols(prev => {
                const n = new Set(prev);
                if (n.has(c)) n.delete(c); else n.add(c);
                return n;
              });
            }}>
              <FormControlLabel
                onClick={e => e.preventDefault()}
                control={<Checkbox size="small" checked={!hiddenCols.has(c)} />}
                label={<Typography variant="caption">{c}</Typography>}
              />
            </MenuItem>
          ))}
        </Menu>
        <Tooltip title="Copy selection (Ctrl+C)">
          <span>
            <IconButton size="small" onClick={copySelection} disabled={!selRect}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" color={copied ? 'success.main' : 'text.disabled'} sx={{ minWidth: 70 }}>
          {copied ? 'Copied!' : `${sorted.length} row${sorted.length === 1 ? '' : 's'}`}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField select size="small" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          SelectProps={{ native: true }} sx={{ width: 80 }}>
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}/pg</option>)}
        </TextField>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: 1, borderColor: 'divider', borderRadius: 1, position: 'relative' }}>
        <Box component="table" sx={{
          borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'auto', fontSize: 11, userSelect: 'none',
          fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        }}>
          <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper' }}>
            <Box component="tr">
              <Box component="th" sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', borderBottom: 1, borderRight: 1, borderColor: 'divider', width: 36, p: 0.4, fontWeight: 700, fontSize: 10, color: 'text.disabled' }}>
                #
              </Box>
              {cols.map((c, ci) => (
                <Box component="th" key={c} onClick={() => toggleSort(c)} sx={{
                  borderBottom: 1, borderColor: 'divider', borderRight: ci < cols.length - 1 ? 1 : 0,
                  px: 0.8, py: 0.5, textAlign: 'left', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  bgcolor: 'background.paper', userSelect: 'none',
                  '&:hover': { bgcolor: 'action.hover' },
                }}>
                  {c}{orderBy === c ? (orderDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {slice.map((row, r) => (
              <Box component="tr" key={r}>
                <Box component="td" sx={{
                  position: 'sticky', left: 0, zIndex: 1, bgcolor: 'action.hover',
                  borderBottom: 1, borderRight: 1, borderColor: 'divider',
                  width: 36, p: 0.4, fontSize: 10, color: 'text.disabled', textAlign: 'right',
                }}>
                  {(safePage - 1) * pageSize + r + 1}
                </Box>
                {cols.map((c, ci) => {
                  const selected = inSel(r, ci);
                  const isFocus = focus?.r === r && focus?.c === ci;
                  const v = cellToDisplay(row[c]);
                  return (
                    <Box component="td" key={c}
                      onMouseDown={e => onCellMouseDown(r, ci, e)}
                      onMouseEnter={() => onCellMouseEnter(r, ci)}
                      title={v}
                      sx={{
                        borderBottom: 1, borderColor: 'divider',
                        borderRight: ci < cols.length - 1 ? 1 : 0,
                        px: 0.8, py: 0.4, whiteSpace: 'nowrap', maxWidth: 320,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        bgcolor: selected ? 'rgba(228, 0, 25, 0.12)' : undefined,
                        outline: isFocus ? '2px solid' : undefined,
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                        cursor: 'cell',
                      }}>
                      {v}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" sx={{ flexShrink: 0 }}>
          <Pagination size="small" page={safePage} count={totalPages} onChange={(_e, p) => setPage(p)} />
        </Stack>
      )}
    </Box>
  );
}
