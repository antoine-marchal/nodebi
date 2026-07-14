export type WidgetType = 'bar-chart' | 'line-chart' | 'area-chart' | 'pie-chart' | 'donut-chart' | 'scatter-chart' | 'table' | 'kpi' | 'stat-card' | 'gauge' | 'text' | 'metric-group' | 'chart-group';
export type DbType = 'nedb' | 'mongodb';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type Role = 'admin' | 'operator' | 'viewer';
export interface User {
    _id: string;
    login: string;
    passwordHash: string | null;
    role: Role;
    createdAt: string;
    updatedAt: string;
}
export interface Namespace {
    _id: string;
    name: string;
    description?: string;
    allowedRoles: Role[];
    allowedUserIds: string[];
    createdAt: string;
    updatedAt: string;
}
export interface DataSource {
    id: string;
    name: string;
    type: DbType;
    nedbPath?: string;
    mongoUri?: string;
    mongoDatabase?: string;
}
export interface ChartConfig {
    dataSourceId: string;
    collection: string;
    queryFilter: string;
    xField: string;
    yField: string;
    aggregation?: AggregationType;
    color?: string;
}
export interface TableConfig {
    dataSourceId: string;
    collection: string;
    queryFilter: string;
    columns: string[] | string;
    limit: number;
}
export interface KPIConfig {
    dataSourceId: string;
    collection: string;
    queryFilter: string;
    valueField: string;
    aggregation: AggregationType;
    label: string;
    format: 'number' | 'currency' | 'percentage';
    prefix?: string;
    suffix?: string;
}
export interface TextConfig {
    content: string;
}
export type WidgetConfig = ChartConfig | TableConfig | KPIConfig | TextConfig;
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
export interface Dashboard {
    _id?: string;
    name: string;
    description?: string;
    tags?: string[];
    dataSources: DataSource[];
    widgets: Widget[];
    layout: LayoutItem[];
    globalFilters?: {
        dateRange?: {
            field: string;
            from?: string;
            to?: string;
        };
    };
    namespaceId?: string;
    ownerId?: string;
    ownerLogin?: string;
    createdAt?: string;
    updatedAt?: string;
}
export interface DashboardRevision {
    _id?: string;
    dashboardId: string;
    snapshot: Dashboard;
    createdAt: string;
}
export interface QueryRequest {
    dataSource: DataSource;
    collection: string;
    queryFilter?: object;
    pipeline?: object[];
    limit?: number;
}
