export type WidgetType =
  | 'bar-chart' | 'line-chart' | 'area-chart' | 'pie-chart' | 'donut-chart' | 'scatter-chart'
  | 'table' | 'kpi' | 'stat-card' | 'gauge' | 'text'
  | 'metric-group' | 'chart-group';

export type MetricItemType = 'kpi' | 'stat-card' | 'gauge';
export type ChartItemType = 'bar-chart' | 'line-chart' | 'area-chart' | 'pie-chart' | 'donut-chart' | 'scatter-chart';

export type DbType = 'nedb' | 'mongodb';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type Role = 'admin' | 'operator' | 'viewer';
export interface User { _id: string; login: string; role: Role; createdAt?: string }
export interface Namespace { _id: string; name: string; description?: string; allowedRoles: Role[]; allowedUserIds: string[]; createdAt?: string; updatedAt?: string }

export interface DataSource {
  id: string;
  name: string;
  type: DbType;
  nedbPath?: string;
  mongoUri?: string;
  mongoDatabase?: string;
}

export interface BaseDataConfig {
  dataSourceId: string;
  collection: string;
  queryFilter: string;
  usePipeline?: boolean;
  pipeline?: string;
}

export interface ChartSeries {
  field: string;
  aggregation?: AggregationType;
  name?: string;
  color?: string;
}

export interface ChartConfig extends BaseDataConfig {
  xField: string;
  yField: string;
  series?: ChartSeries[];
  aggregation?: AggregationType;
  color?: string;
  showLabels?: boolean;
  showLegend?: boolean;
  legendName?: string;
}

export interface TableConfig extends BaseDataConfig {
  columns: string;
  limit: number;
}

export interface KPIConfig extends BaseDataConfig {
  valueField: string;
  aggregation: AggregationType;
  label: string;
  format: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  accentColor?: string;
}

export interface StatCardConfig extends BaseDataConfig {
  valueField: string;
  aggregation: AggregationType;
  label: string;
  format: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  colorScheme: 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon?: string;
  description?: string;
  accentColor?: string;
}

export interface GaugeConfig extends BaseDataConfig {
  valueField: string;
  aggregation: AggregationType;
  label: string;
  min: number;
  max: number;
  unit?: string;
  accentColor?: string;
}

export interface TextConfig {
  content: string;
}

export interface MetricItem {
  id: string;
  type: MetricItemType;
  config: KPIConfig | StatCardConfig | GaugeConfig;
}

export interface MetricGroupConfig {
  items: MetricItem[];
  columns: number;
}

export interface ChartItem {
  id: string;
  type: ChartItemType;
  title?: string;
  config: ChartConfig;
}

export interface ChartGroupConfig {
  items: ChartItem[];
  columns: number;
}

export type WidgetConfig =
  | ChartConfig | TableConfig | KPIConfig | StatCardConfig | GaugeConfig | TextConfig
  | MetricGroupConfig | ChartGroupConfig;

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  refreshIntervalSec?: number;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface GlobalFilters {
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface Dashboard {
  _id?: string;
  name: string;
  description?: string;
  tags?: string[];
  dataSources: DataSource[];
  widgets: Widget[];
  layout: LayoutItem[];
  globalFilters?: GlobalFilters;
  namespaceId?: string;
  ownerId?: string;
  ownerLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const WIDGET_DEFAULTS: Record<WidgetType, { w: number; h: number; minW: number; minH: number }> = {
  'bar-chart':    { w: 6, h: 5, minW: 1, minH: 2 },
  'line-chart':   { w: 6, h: 5, minW: 1, minH: 2 },
  'area-chart':   { w: 6, h: 5, minW: 1, minH: 2 },
  'pie-chart':    { w: 4, h: 5, minW: 1, minH: 2 },
  'donut-chart':  { w: 4, h: 5, minW: 1, minH: 2 },
  'scatter-chart':{ w: 5, h: 5, minW: 1, minH: 2 },
  'table':        { w: 6, h: 6, minW: 1, minH: 2 },
  'kpi':          { w: 3, h: 2, minW: 1, minH: 1 },
  'stat-card':    { w: 3, h: 3, minW: 1, minH: 1 },
  'gauge':        { w: 3, h: 4, minW: 1, minH: 2 },
  'text':         { w: 4, h: 3, minW: 1, minH: 1 },
  'metric-group': { w: 8, h: 4, minW: 2, minH: 2 },
  'chart-group':  { w: 12, h: 7, minW: 3, minH: 3 },
};

export function createDefaultConfig(type: WidgetType): WidgetConfig {
  switch (type) {
    case 'text':
      return { content: '## Text Widget\nEdit this widget to add content.\n\n- Supports **Markdown**\n- `code` formatting' };
    case 'kpi':
      return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'count', label: 'Total', format: 'number' };
    case 'stat-card':
      return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'count', label: 'Total', format: 'number', colorScheme: 'primary', icon: '', description: '' };
    case 'gauge':
      return { dataSourceId: '', collection: '', queryFilter: '{}', valueField: '', aggregation: 'sum', label: 'Value', min: 0, max: 100, unit: '' };
    case 'metric-group':
      return { items: [], columns: 3 };
    case 'chart-group':
      return { items: [], columns: 2 };
    case 'table':
      return { dataSourceId: '', collection: '', queryFilter: '{}', columns: '', limit: 50 };
    case 'scatter-chart':
      return { dataSourceId: '', collection: '', queryFilter: '{}', xField: '', yField: '', series: [{ field: '' }], showLabels: false };
    case 'pie-chart':
    case 'donut-chart':
      return { dataSourceId: '', collection: '', queryFilter: '{}', xField: '', yField: '', aggregation: 'sum', showLabels: false, showLegend: false };
    default:
      return { dataSourceId: '', collection: '', queryFilter: '{}', xField: '', yField: '', series: [{ field: '', aggregation: 'sum' }], aggregation: 'sum', showLabels: false, showLegend: false };
  }
}

export const CHART_TYPES: WidgetType[] = ['bar-chart', 'line-chart', 'area-chart', 'pie-chart', 'donut-chart', 'scatter-chart'];
export const METRIC_TYPES: WidgetType[] = ['kpi', 'stat-card', 'gauge'];

export function isChartType(t: WidgetType): boolean { return CHART_TYPES.includes(t); }
export function isMetricType(t: WidgetType): boolean { return METRIC_TYPES.includes(t); }
export function isPieType(t: WidgetType): boolean { return t === 'pie-chart' || t === 'donut-chart'; }
