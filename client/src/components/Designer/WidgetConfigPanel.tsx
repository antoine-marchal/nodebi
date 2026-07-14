import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Select, MenuItem, FormControl,
  InputLabel, IconButton, Tooltip, Chip, FormHelperText, Autocomplete,
  Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Alert, Button, Divider,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useDashboardStore } from '../../store';
import {
  ChartConfig, KPIConfig, StatCardConfig, GaugeConfig, TextConfig,
  MetricGroupConfig, MetricItem, MetricItemType,
  ChartGroupConfig, ChartItem, ChartItemType,
  DataSource, isChartType, isMetricType, isPieType,
} from '../../types';
import { queryApi } from '../../services/api';
import { v4 as uuidv4 } from 'uuid';

const AGGREGATIONS = [
  { v: 'count', l: 'Count' }, { v: 'sum', l: 'Sum' }, { v: 'avg', l: 'Average' },
  { v: 'min', l: 'Minimum' }, { v: 'max', l: 'Maximum' },
];
const FORMATS = [{ v: 'number', l: 'Number' }, { v: 'currency', l: 'Currency' }, { v: 'percentage', l: 'Percentage' }];
const COLOR_SCHEMES = [
  { v: 'primary', l: 'Blue' }, { v: 'success', l: 'Green' }, { v: 'warning', l: 'Amber' },
  { v: 'error', l: 'Red' }, { v: 'info', l: 'Cyan' },
];

const METRIC_ITEM_TYPES: { v: MetricItemType; l: string }[] = [
  { v: 'kpi', l: 'KPI Card' }, { v: 'stat-card', l: 'Stat Card' }, { v: 'gauge', l: 'Gauge' },
];
const CHART_ITEM_TYPES: { v: ChartItemType; l: string }[] = [
  { v: 'bar-chart', l: 'Bar' }, { v: 'line-chart', l: 'Line' }, { v: 'area-chart', l: 'Area' },
  { v: 'pie-chart', l: 'Pie' }, { v: 'donut-chart', l: 'Donut' }, { v: 'scatter-chart', l: 'Scatter' },
];

const PIPELINE_EXAMPLE_CHART = `[
  { "$match": { } },
  { "$group": { "_id": "$field", "value": { "$sum": 1 } } },
  { "$sort": { "_id": 1 } }
]`;
const PIPELINE_EXAMPLE_METRIC = `[
  { "$match": { } },
  { "$group": { "_id": null, "value": { "$sum": 1 } } }
]`;

const PRESET_COLORS = ['', '#E40019', '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#0284c7', '#16a34a', '#64748b'];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <TextField
        label={label} value={value || ''} onChange={e => onChange(e.target.value)}
        size="small" fullWidth placeholder="#E40019 (leave empty for theme)"
        InputProps={{
          startAdornment: (
            <Box sx={{
              width: 18, height: 18, mr: 1, borderRadius: '4px',
              border: 1, borderColor: 'divider',
              bgcolor: value || 'transparent',
              backgroundImage: value ? undefined : 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px',
              flexShrink: 0,
            }} />
          ),
          endAdornment: (
            <input type="color" value={value || '#E40019'} onChange={e => onChange(e.target.value)}
              style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
          ),
        }}
      />
      <Box sx={{ display: 'flex', gap: 0.3, flexWrap: 'wrap' }}>
        {PRESET_COLORS.map((c, i) => (
          <Tooltip key={i} title={c || 'Theme default'}>
            <Box onClick={() => onChange(c)} sx={{
              width: 16, height: 16, borderRadius: '3px',
              border: 1, borderColor: value === c ? 'primary.main' : 'divider',
              bgcolor: c || 'transparent',
              backgroundImage: c ? undefined : 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
              backgroundSize: '6px 6px', backgroundPosition: '0 0, 3px 3px',
              cursor: 'pointer', flexShrink: 0,
              '&:hover': { borderColor: 'primary.main' },
            }} />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}

function useCollections(dataSourceId: string, dataSources: DataSource[]) {
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataSourceId) { setCollections([]); setError(''); return; }
    const ds = dataSources.find(d => d.id === dataSourceId);
    if (!ds) { setCollections([]); setError(''); return; }
    let cancelled = false;
    setLoading(true); setError('');
    queryApi.collections(ds)
      .then(c => { if (!cancelled) setCollections(c); })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.error || e?.message || 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dataSourceId, dataSources, reloadKey]);

  return { collections, loading, error, refresh: () => setReloadKey(k => k + 1) };
}

function CollectionSelect({
  value, onChange, dataSourceId, dataSources,
}: {
  value: string;
  onChange: (v: string) => void;
  dataSourceId: string;
  dataSources: DataSource[];
}) {
  const { collections, loading, error, refresh } = useCollections(dataSourceId, dataSources);
  const noDs = !dataSourceId;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
      <Autocomplete
        freeSolo
        openOnFocus
        size="small"
        options={collections}
        value={value || ''}
        onChange={(_e, v) => onChange((v as string) || '')}
        onInputChange={(_e, v) => onChange(v)}
        loading={loading}
        disabled={noDs}
        sx={{ flex: 1 }}
        noOptionsText={loading ? 'Loading…' : error ? error : (noDs ? 'Pick data source first' : 'No collections found')}
        renderInput={params => (
          <TextField
            {...params}
            label="Collection / Table"
            error={!!error}
            helperText={error || (noDs ? 'Pick data source first' : '')}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      <Tooltip title="Refresh collections">
        <span>
          <IconButton size="small" onClick={refresh} disabled={noDs} sx={{ mt: 0.5 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

function useSampleFields(dataSourceId: string, collection: string, dataSources: DataSource[]) {
  const [fields, setFields] = useState<string[]>([]);
  useEffect(() => {
    if (!dataSourceId || !collection) { setFields([]); return; }
    const ds = dataSources.find(d => d.id === dataSourceId);
    if (!ds) { setFields([]); return; }
    queryApi.sample(ds, collection)
      .then(doc => setFields(doc ? Object.keys(doc) : []))
      .catch(() => setFields([]));
  }, [dataSourceId, collection, dataSources]);
  return fields;
}

function PipelineBlock({ cfg, onChange, example }: { cfg: any; onChange: (patch: any) => void; example: string }) {
  const [err, setErr] = useState('');
  const validate = (val: string) => {
    try { const p = JSON.parse(val); if (!Array.isArray(p)) throw new Error('Must be JSON array'); setErr(''); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
      <FormControlLabel
        control={<Switch size="small" checked={!!cfg.usePipeline} onChange={e => onChange({ usePipeline: e.target.checked })} />}
        label={<Typography variant="caption">Custom pipeline</Typography>}
      />
      {cfg.usePipeline && (
        <>
          <TextField
            label="Pipeline (JSON array)"
            value={cfg.pipeline || example}
            onChange={e => { onChange({ pipeline: e.target.value }); validate(e.target.value); }}
            onBlur={e => validate(e.target.value)}
            multiline rows={8} size="small" fullWidth
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
            error={!!err}
            helperText={err || 'MongoDB-style aggregation stages — overrides filter/fields.'}
          />
          {!err && (
            <Alert severity="info" sx={{ py: 0, fontSize: 11 }}>
              Pipeline overrides filter/fields/aggregation.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

function FilterField({ cfg, onChange }: { cfg: any; onChange: (patch: any) => void }) {
  const [err, setErr] = useState('');
  const validate = (val: string) => {
    if (!val.trim()) { setErr(''); return; }
    try { JSON.parse(val); setErr(''); } catch (e: any) { setErr(e.message); }
  };
  return (
    <TextField
      label="Filter (JSON)" value={cfg.queryFilter || '{}'}
      onChange={e => { onChange({ queryFilter: e.target.value }); validate(e.target.value); }}
      onBlur={e => validate(e.target.value)}
      size="small" fullWidth multiline rows={2}
      inputProps={{ style: { fontFamily: 'monospace', fontSize: 11 } }}
      error={!!err}
      helperText={err || 'e.g. {"status":"active"}'}
    />
  );
}

function DataSourceSelect({ value, onChange, dataSources }: { value: string; onChange: (v: string) => void; dataSources: DataSource[] }) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>Data Source</InputLabel>
      <Select value={value || ''} label="Data Source" onChange={e => onChange(e.target.value)}>
        {dataSources.length === 0 && <MenuItem value="" disabled>No sources</MenuItem>}
        {dataSources.map(ds => (
          <MenuItem key={ds.id} value={ds.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={ds.type} size="small" color={ds.type === 'mongodb' ? 'success' : 'info'} sx={{ height: 16, fontSize: 9 }} />
              {ds.name}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function FieldAutocomplete({ label, value, onChange, fields }: { label: string; value: string; onChange: (v: string) => void; fields: string[] }) {
  return (
    <Autocomplete
      freeSolo size="small" options={fields}
      value={value || ''}
      onInputChange={(_e, v) => onChange(v)}
      renderInput={params => <TextField {...params} label={label} />}
    />
  );
}

function MetricItemEditor({
  item, dataSources, onChange, onRemove,
}: {
  item: MetricItem; dataSources: DataSource[];
  onChange: (patch: Partial<KPIConfig & StatCardConfig & GaugeConfig>) => void;
  onRemove: () => void;
}) {
  const cfg = item.config as any;
  const fields = useSampleFields(cfg.dataSourceId, cfg.collection, dataSources);

  const isKPI = item.type === 'kpi';
  const isStatCard = item.type === 'stat-card';
  const isGauge = item.type === 'gauge';

  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '6px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 34, '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center', gap: 1 } }}>
        <Chip label={item.type} size="small" color="primary" variant="outlined" sx={{ fontSize: 9, height: 18 }} />
        <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }} noWrap>{cfg.label || '(no label)'}</Typography>
        <IconButton size="small" onClick={e => { e.stopPropagation(); onRemove(); }} sx={{ p: 0.2, mr: 0.5 }} color="error">
          <DeleteIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <DataSourceSelect value={cfg.dataSourceId} onChange={v => onChange({ dataSourceId: v })} dataSources={dataSources} />
        <CollectionSelect value={cfg.collection || ''} onChange={v => onChange({ collection: v })}
          dataSourceId={cfg.dataSourceId} dataSources={dataSources} />
        {!cfg.usePipeline && <FilterField cfg={cfg} onChange={onChange} />}
        <TextField label="Label" value={cfg.label || ''} onChange={e => onChange({ label: e.target.value })} size="small" fullWidth />

        {!cfg.usePipeline && (isKPI || isStatCard) && (
          <>
            <FieldAutocomplete label="Value field (blank = row count)" value={cfg.valueField || ''} onChange={v => onChange({ valueField: v })} fields={fields} />
            <FormControl size="small" fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select value={cfg.aggregation || 'count'} label="Aggregation" onChange={e => onChange({ aggregation: e.target.value as any })}>
                {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
              </Select>
            </FormControl>
          </>
        )}
        {(isKPI || isStatCard) && (
          <>
            <FormControl size="small" fullWidth>
              <InputLabel>Format</InputLabel>
              <Select value={cfg.format || 'number'} label="Format" onChange={e => onChange({ format: e.target.value as any })}>
                {FORMATS.map(f => <MenuItem key={f.v} value={f.v}>{f.l}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Prefix" value={cfg.prefix || ''} onChange={e => onChange({ prefix: e.target.value })} size="small" sx={{ flex: 1 }} />
              <TextField label="Suffix" value={cfg.suffix || ''} onChange={e => onChange({ suffix: e.target.value })} size="small" sx={{ flex: 1 }} />
            </Box>
          </>
        )}
        {isStatCard && (
          <>
            <FormControl size="small" fullWidth>
              <InputLabel>Colour Scheme</InputLabel>
              <Select value={cfg.colorScheme || 'primary'} label="Colour Scheme" onChange={e => onChange({ colorScheme: e.target.value as any })}>
                {COLOR_SCHEMES.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Icon (emoji)" value={cfg.icon || ''} onChange={e => onChange({ icon: e.target.value })} size="small" fullWidth placeholder="📊" />
          </>
        )}
        {!cfg.usePipeline && isGauge && (
          <>
            <FieldAutocomplete label="Value field" value={cfg.valueField || ''} onChange={v => onChange({ valueField: v })} fields={fields} />
            <FormControl size="small" fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select value={cfg.aggregation || 'sum'} label="Aggregation" onChange={e => onChange({ aggregation: e.target.value as any })}>
                {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
              </Select>
            </FormControl>
          </>
        )}
        {isGauge && (
          <>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Min" type="number" value={cfg.min ?? 0} onChange={e => onChange({ min: parseFloat(e.target.value) || 0 })} size="small" sx={{ flex: 1 }} />
              <TextField label="Max" type="number" value={cfg.max ?? 100} onChange={e => onChange({ max: parseFloat(e.target.value) || 100 })} size="small" sx={{ flex: 1 }} />
            </Box>
            <TextField label="Unit" value={cfg.unit || ''} onChange={e => onChange({ unit: e.target.value })} size="small" fullWidth placeholder="%, ms, $" />
          </>
        )}
        <ColorField label="Accent colour" value={cfg.accentColor || ''} onChange={v => onChange({ accentColor: v })} />
        <PipelineBlock cfg={cfg} onChange={onChange} example={PIPELINE_EXAMPLE_METRIC} />
      </AccordionDetails>
    </Accordion>
  );
}

function defaultMetricConfig(type: MetricItemType): KPIConfig | StatCardConfig | GaugeConfig {
  if (type === 'kpi') return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'count', label: 'Total', format: 'number' };
  if (type === 'stat-card') return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'count', label: 'Total', format: 'number', colorScheme: 'primary', icon: '', description: '' };
  return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'sum', label: 'Value', min: 0, max: 100, unit: '' };
}

function MetricGroupEditor({ cfg, setConfig, dataSources }: { cfg: MetricGroupConfig; setConfig: (p: object) => void; dataSources: DataSource[] }) {
  const [addType, setAddType] = useState<MetricItemType>('kpi');
  const items: MetricItem[] = cfg.items || [];

  const addItem = () => setConfig({ items: [...items, { id: uuidv4(), type: addType, config: defaultMetricConfig(addType) }] });
  const removeItem = (id: string) => setConfig({ items: items.filter(it => it.id !== id) });
  const updateItem = (id: string, patch: object) =>
    setConfig({ items: items.map(it => it.id === id ? { ...it, config: { ...it.config, ...patch } } : it) });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Layout</Typography>
      <FormControl size="small" fullWidth>
        <InputLabel>Columns</InputLabel>
        <Select value={cfg.columns || 3} label="Columns" onChange={e => setConfig({ columns: Number(e.target.value) })}>
          {[1, 2, 3, 4].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </Select>
      </FormControl>
      <Divider />
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Metrics ({items.length})</Typography>
      {items.map(item => (
        <MetricItemEditor key={item.id} item={item} dataSources={dataSources}
          onChange={patch => updateItem(item.id, patch)} onRemove={() => removeItem(item.id)} />
      ))}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Type</InputLabel>
          <Select value={addType} label="Type" onChange={e => setAddType(e.target.value as MetricItemType)}>
            {METRIC_ITEM_TYPES.map(t => <MenuItem key={t.v} value={t.v}>{t.l}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addItem} sx={{ flexShrink: 0 }}>Add</Button>
      </Box>
    </Box>
  );
}

function defaultChartItemConfig(type: ChartItemType): ChartConfig {
  if (type === 'scatter-chart') return { dataSourceId: '', collection: '', queryFilter: '{}', xField: '', yField: '', showLabels: false };
  return { dataSourceId: '', collection: '', queryFilter: '{}', xField: '', yField: '', aggregation: 'sum', showLabels: false, showLegend: false };
}

function ChartItemEditor({
  item, dataSources, onChange, onChangeMeta, onRemove,
}: {
  item: ChartItem; dataSources: DataSource[];
  onChange: (patch: Partial<ChartConfig>) => void;
  onChangeMeta: (patch: Partial<Pick<ChartItem, 'title'>>) => void;
  onRemove: () => void;
}) {
  const cfg = item.config;
  const fields = useSampleFields(cfg.dataSourceId, cfg.collection, dataSources);
  const isPie = isPieType(item.type);
  const isScatter = item.type === 'scatter-chart';

  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '6px !important', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 34, '& .MuiAccordionSummary-content': { my: 0.5, alignItems: 'center', gap: 1 } }}>
        <Chip label={item.type.replace('-chart', '')} size="small" color="primary" variant="outlined" sx={{ fontSize: 9, height: 18 }} />
        <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }} noWrap>{item.title || '(untitled)'}</Typography>
        <IconButton size="small" onClick={e => { e.stopPropagation(); onRemove(); }} sx={{ p: 0.2, mr: 0.5 }} color="error">
          <DeleteIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField label="Title" value={item.title || ''} onChange={e => onChangeMeta({ title: e.target.value })} size="small" fullWidth />
        <DataSourceSelect value={cfg.dataSourceId} onChange={v => onChange({ dataSourceId: v })} dataSources={dataSources} />
        <CollectionSelect value={cfg.collection || ''} onChange={v => onChange({ collection: v })}
          dataSourceId={cfg.dataSourceId} dataSources={dataSources} />
        {!cfg.usePipeline && <FilterField cfg={cfg} onChange={onChange} />}
        {!cfg.usePipeline && (
          <>
            <FieldAutocomplete label={isPie ? 'Label field' : 'X axis field'} value={cfg.xField || ''}
              onChange={v => onChange({ xField: v })} fields={fields} />
            <FieldAutocomplete label={isPie ? 'Value field' : 'Y axis field'} value={cfg.yField || ''}
              onChange={v => onChange({ yField: v })} fields={fields} />
            {!isScatter && (
              <FormControl size="small" fullWidth>
                <InputLabel>Aggregation</InputLabel>
                <Select value={cfg.aggregation || 'sum'} label="Aggregation" onChange={e => onChange({ aggregation: e.target.value as any })}>
                  {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </>
        )}
        <ColorField label="Accent colour" value={cfg.color || ''} onChange={v => onChange({ color: v })} />
        {!isPie && (
          <FormControlLabel
            control={<Switch size="small" checked={!!cfg.showLabels} onChange={e => onChange({ showLabels: e.target.checked })} />}
            label={<Typography variant="caption">Show value labels</Typography>} />
        )}
        <FormControlLabel
          control={<Switch size="small" checked={!!cfg.showLegend} onChange={e => onChange({ showLegend: e.target.checked })} />}
          label={<Typography variant="caption">Show legend</Typography>} />
        <PipelineBlock cfg={cfg} onChange={onChange} example={PIPELINE_EXAMPLE_CHART} />
      </AccordionDetails>
    </Accordion>
  );
}

function ChartGroupEditor({ cfg, setConfig, dataSources }: { cfg: ChartGroupConfig; setConfig: (p: object) => void; dataSources: DataSource[] }) {
  const [addType, setAddType] = useState<ChartItemType>('bar-chart');
  const items: ChartItem[] = cfg.items || [];
  const addItem = () => setConfig({ items: [...items, { id: uuidv4(), type: addType, title: '', config: defaultChartItemConfig(addType) }] });
  const removeItem = (id: string) => setConfig({ items: items.filter(it => it.id !== id) });
  const updateItemConfig = (id: string, patch: object) =>
    setConfig({ items: items.map(it => it.id === id ? { ...it, config: { ...it.config, ...patch } } : it) });
  const updateItemMeta = (id: string, patch: object) =>
    setConfig({ items: items.map(it => it.id === id ? { ...it, ...patch } : it) });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Layout</Typography>
      <FormControl size="small" fullWidth>
        <InputLabel>Columns</InputLabel>
        <Select value={cfg.columns || 2} label="Columns" onChange={e => setConfig({ columns: Number(e.target.value) })}>
          {[1, 2, 3, 4].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </Select>
      </FormControl>
      <Divider />
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Charts ({items.length})</Typography>
      {items.map(item => (
        <ChartItemEditor key={item.id} item={item} dataSources={dataSources}
          onChange={patch => updateItemConfig(item.id, patch)}
          onChangeMeta={patch => updateItemMeta(item.id, patch)}
          onRemove={() => removeItem(item.id)} />
      ))}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Type</InputLabel>
          <Select value={addType} label="Type" onChange={e => setAddType(e.target.value as ChartItemType)}>
            {CHART_ITEM_TYPES.map(t => <MenuItem key={t.v} value={t.v}>{t.l}</MenuItem>)}
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addItem} sx={{ flexShrink: 0 }}>Add</Button>
      </Box>
    </Box>
  );
}

export default function WidgetConfigPanel() {
  const { dashboard, selectedWidgetId, selectWidget, updateWidget, removeWidget, duplicateWidget } = useDashboardStore();
  const widget = dashboard.widgets.find(w => w.id === selectedWidgetId);

  // Hooks must run unconditionally — read values safely whether or not a widget is selected.
  const cfg = (widget?.config as any) || {};
  const fields = useSampleFields(cfg.dataSourceId || '', cfg.collection || '', dashboard.dataSources);

  if (!widget) {
    return (
      <Paper elevation={0} sx={{
        width: 320, flexShrink: 0, borderLeft: 1, borderColor: 'divider',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', p: 3, borderRadius: 0,
      }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', mb: 1.5 }}><TuneIcon /></Box>
        <Typography variant="subtitle2" textAlign="center">Nothing selected</Typography>
        <Typography color="text.secondary" variant="caption" textAlign="center" sx={{ mt: .5, maxWidth: 220 }}>Select a widget on the canvas to configure its data, labels, and appearance.</Typography>
      </Paper>
    );
  }

  const setConfig = (patch: object) => updateWidget(widget.id, { config: { ...widget.config, ...patch } });

  const t = widget.type;
  const isChart = isChartType(t) && t !== 'scatter-chart';
  const isScatter = t === 'scatter-chart';
  const isTable = t === 'table';
  const isKPI = t === 'kpi';
  const isStatCard = t === 'stat-card';
  const isGauge = t === 'gauge';
  const isText = t === 'text';
  const isMetricGroup = t === 'metric-group';
  const isChartGroup = t === 'chart-group';
  const hasData = !isText && !isMetricGroup && !isChartGroup;
  const hasPipeline = hasData;
  const isPie = isPieType(t);
  const dsOptions = dashboard.dataSources;

  const pipelineExample = isMetricType(t) ? PIPELINE_EXAMPLE_METRIC : PIPELINE_EXAMPLE_CHART;

  return (
    <Paper elevation={0} sx={{
      width: 320, flexShrink: 0, borderLeft: 1, borderColor: 'divider',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 0,
    }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center' }}><TuneIcon fontSize="small" /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.1 }}>Widget inspector</Typography>
          <Typography variant="caption" color="text.secondary">{widget.type.replace(/-/g, ' ')}</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Duplicate widget">
          <IconButton size="small" onClick={() => duplicateWidget(widget.id)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete widget">
          <IconButton size="small" color="error" onClick={() => { removeWidget(widget.id); selectWidget(null); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={() => selectWidget(null)}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField label="Title" value={widget.title} onChange={e => updateWidget(widget.id, { title: e.target.value })} size="small" fullWidth />

        <TextField
          label="Refresh interval (sec, 0 = off)" type="number"
          value={widget.refreshIntervalSec ?? 0}
          onChange={e => updateWidget(widget.id, { refreshIntervalSec: Math.max(0, parseInt(e.target.value) || 0) })}
          size="small" fullWidth inputProps={{ min: 0, step: 5 }}
          helperText="Minimum 5s"
        />

        {isMetricGroup && <MetricGroupEditor cfg={cfg as MetricGroupConfig} setConfig={setConfig} dataSources={dsOptions} />}
        {isChartGroup && <ChartGroupEditor cfg={cfg as ChartGroupConfig} setConfig={setConfig} dataSources={dsOptions} />}

        {isText && (
          <TextField label="Content (Markdown)" value={(cfg as TextConfig).content}
            onChange={e => setConfig({ content: e.target.value })}
            multiline rows={10} size="small" fullWidth
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }} />
        )}

        {hasData && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Data</Typography>
            <DataSourceSelect value={cfg.dataSourceId} onChange={v => setConfig({ dataSourceId: v })} dataSources={dsOptions} />
            <CollectionSelect value={cfg.collection || ''} onChange={v => setConfig({ collection: v })}
              dataSourceId={cfg.dataSourceId || ''} dataSources={dsOptions} />
            {!cfg.usePipeline && <FilterField cfg={cfg} onChange={setConfig} />}
          </>
        )}

        {(isChart || isScatter) && !cfg.usePipeline && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>{isPie ? 'Fields' : 'Axes'}</Typography>
            <FieldAutocomplete label={isPie ? 'Label field' : 'X axis field'} value={cfg.xField || ''}
              onChange={v => setConfig({ xField: v })} fields={fields} />
            <FieldAutocomplete label={isPie ? 'Value field' : 'Y axis field (value)'} value={cfg.yField || ''}
              onChange={v => setConfig({ yField: v })} fields={fields} />
            {!isScatter && (
              <FormControl size="small" fullWidth>
                <InputLabel>Aggregation</InputLabel>
                <Select value={cfg.aggregation || 'sum'} label="Aggregation" onChange={e => setConfig({ aggregation: e.target.value })}>
                  {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
                </Select>
                <FormHelperText>How to combine Y values per X group</FormHelperText>
              </FormControl>
            )}
          </>
        )}

        {(isChart || isScatter) && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Appearance</Typography>
            <ColorField label="Accent colour" value={cfg.color || ''} onChange={v => setConfig({ color: v })} />
            {!isPie && (
              <FormControlLabel
                control={<Switch size="small" checked={!!cfg.showLabels} onChange={e => setConfig({ showLabels: e.target.checked })} />}
                label={<Typography variant="caption">Show value labels</Typography>} />
            )}
            <FormControlLabel
              control={<Switch size="small" checked={!!cfg.showLegend} onChange={e => setConfig({ showLegend: e.target.checked })} />}
              label={<Typography variant="caption">Show legend</Typography>} />
          </>
        )}

        {isTable && !cfg.usePipeline && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Table Options</Typography>
            <TextField label="Columns (comma-separated, blank=all)" value={cfg.columns || ''} onChange={e => setConfig({ columns: e.target.value })} size="small" fullWidth placeholder="name,age,status" />
            <TextField label="Max rows" type="number" value={cfg.limit || 50} onChange={e => setConfig({ limit: parseInt(e.target.value) || 50 })} size="small" fullWidth inputProps={{ min: 1, max: 5000 }} />
          </>
        )}

        {(isKPI || isStatCard) && !cfg.usePipeline && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Metric</Typography>
            <FieldAutocomplete label="Value field (blank = row count)" value={cfg.valueField || ''} onChange={v => setConfig({ valueField: v })} fields={fields} />
            <FormControl size="small" fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select value={cfg.aggregation || 'count'} label="Aggregation" onChange={e => setConfig({ aggregation: e.target.value })}>
                {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Label" value={cfg.label || ''} onChange={e => setConfig({ label: e.target.value })} size="small" fullWidth />
            <FormControl size="small" fullWidth>
              <InputLabel>Format</InputLabel>
              <Select value={cfg.format || 'number'} label="Format" onChange={e => setConfig({ format: e.target.value })}>
                {FORMATS.map(f => <MenuItem key={f.v} value={f.v}>{f.l}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Prefix" value={cfg.prefix || ''} onChange={e => setConfig({ prefix: e.target.value })} size="small" sx={{ flex: 1 }} />
              <TextField label="Suffix" value={cfg.suffix || ''} onChange={e => setConfig({ suffix: e.target.value })} size="small" sx={{ flex: 1 }} />
            </Box>
            {!isStatCard && (
              <ColorField label="Accent colour" value={cfg.accentColor || ''} onChange={v => setConfig({ accentColor: v })} />
            )}
          </>
        )}

        {isStatCard && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Style</Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Colour Scheme</InputLabel>
              <Select value={(cfg as StatCardConfig).colorScheme || 'primary'} label="Colour Scheme" onChange={e => setConfig({ colorScheme: e.target.value })}>
                {COLOR_SCHEMES.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}
              </Select>
            </FormControl>
            <ColorField label="Accent colour (override)" value={(cfg as StatCardConfig).accentColor || ''} onChange={v => setConfig({ accentColor: v })} />
            <TextField label="Icon (emoji)" value={(cfg as StatCardConfig).icon || ''} onChange={e => setConfig({ icon: e.target.value })} size="small" fullWidth placeholder="📊" />
            <TextField label="Description" value={(cfg as StatCardConfig).description || ''} onChange={e => setConfig({ description: e.target.value })} size="small" fullWidth />
          </>
        )}

        {isGauge && !cfg.usePipeline && (
          <>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mt: 0.5 }}>Gauge</Typography>
            <FieldAutocomplete label="Value field" value={(cfg as GaugeConfig).valueField || ''} onChange={v => setConfig({ valueField: v })} fields={fields} />
            <FormControl size="small" fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select value={(cfg as GaugeConfig).aggregation || 'sum'} label="Aggregation" onChange={e => setConfig({ aggregation: e.target.value })}>
                {AGGREGATIONS.map(a => <MenuItem key={a.v} value={a.v}>{a.l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Label" value={(cfg as GaugeConfig).label || ''} onChange={e => setConfig({ label: e.target.value })} size="small" fullWidth />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Min" type="number" value={(cfg as GaugeConfig).min ?? 0} onChange={e => setConfig({ min: parseFloat(e.target.value) || 0 })} size="small" sx={{ flex: 1 }} />
              <TextField label="Max" type="number" value={(cfg as GaugeConfig).max ?? 100} onChange={e => setConfig({ max: parseFloat(e.target.value) || 100 })} size="small" sx={{ flex: 1 }} />
            </Box>
            <TextField label="Unit (e.g. %, ms, $)" value={(cfg as GaugeConfig).unit || ''} onChange={e => setConfig({ unit: e.target.value })} size="small" fullWidth />
            <ColorField label="Accent colour (overrides zone colour)" value={(cfg as GaugeConfig).accentColor || ''} onChange={v => setConfig({ accentColor: v })} />
          </>
        )}

        {hasPipeline && (
          <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', mt: 1, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountTreeIcon sx={{ fontSize: 16, color: cfg.usePipeline ? 'primary.main' : 'text.disabled' }} />
                <Typography variant="caption" fontWeight={600} color={cfg.usePipeline ? 'primary.main' : 'text.secondary'}>
                  Pipeline Mode {cfg.usePipeline ? '(active)' : ''}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <PipelineBlock cfg={cfg} onChange={setConfig} example={pipelineExample} />
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Paper>
  );
}
