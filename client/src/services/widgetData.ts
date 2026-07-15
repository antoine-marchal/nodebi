import { ChartConfig, KPIConfig, StatCardConfig, GaugeConfig, DataSource, ChartItemType, GlobalFilters } from '../types';
import { queryApi, shareApi } from './api';

export function safeJSON(str: string): object {
  try {
    const parsed = JSON.parse(str || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function parsePipeline(str: string): object[] | null {
  try { const p = JSON.parse(str); if (Array.isArray(p)) return p; } catch { /* invalid pipelines are handled by the caller */ }
  return null;
}

function globalFilterQuery(gf?: GlobalFilters, coerceMongoDates = false): object {
  if (!gf) return {};
  const search = gf.search ? safeJSON(gf.search) : {};
  if (gf.dateField && (gf.dateFrom || gf.dateTo)) {
    if (coerceMongoDates) {
      const fieldDate = { $convert: { input: `$${gf.dateField}`, to: 'date', onError: null, onNull: null } };
      const comparisons: object[] = [];
      if (gf.dateFrom) comparisons.push({ $gte: [fieldDate, { $toDate: gf.dateFrom }] });
      if (gf.dateTo) comparisons.push({ $lte: [fieldDate, { $toDate: `${gf.dateTo}T23:59:59.999Z` }] });
      const dateQuery = { $expr: comparisons.length === 1 ? comparisons[0] : { $and: comparisons } };
      return Object.keys(search).length ? { $and: [search, dateQuery] } : dateQuery;
    }
    const range: any = {};
    if (gf.dateFrom) range.$gte = gf.dateFrom;
    if (gf.dateTo) range.$lte = gf.dateTo;
    if (Object.keys(range).length) return { ...search, [gf.dateField]: { ...(search as any)[gf.dateField], ...range } };
  }
  return search;
}

function mergeGlobalFilters(base: object, gf?: GlobalFilters, coerceMongoDates = false): object {
  const global = globalFilterQuery(gf, coerceMongoDates);
  if (!Object.keys(global).length) return base;
  if (!Object.keys(base).length) return global;
  return { $and: [base, global] };
}

export function applyGlobalFiltersToPipeline(pipeline: object[], gf?: GlobalFilters, coerceMongoDates = false): object[] {
  const global = globalFilterQuery(gf, coerceMongoDates);
  if (!Object.keys(global).length) return pipeline;

  const stages = pipeline as Record<string, any>[];
  const filterFields = new Set([
    ...(gf?.dateField ? [gf.dateField] : []),
    ...Object.keys(gf?.search ? safeJSON(gf.search) : {}).filter(key => !key.startsWith('$')),
  ]);
  let insertAt = 0;
  for (let i = 0; i < stages.length; i += 1) {
    if (stages[i].$group) break;
    const computed = stages[i].$addFields || stages[i].$set;
    if (computed && Object.keys(computed).some(field => filterFields.has(field))) insertAt = i + 1;
  }

  if (stages[insertAt]?.$match) {
    return [
      ...stages.slice(0, insertAt),
      { $match: { $and: [stages[insertAt].$match, global] } },
      ...stages.slice(insertAt + 1),
    ];
  }
  return [...stages.slice(0, insertAt), { $match: global }, ...stages.slice(insertAt)];
}

function isMongoSource(ctx: QueryContext, dataSourceId: string): boolean {
  return ctx.dataSources.find(ds => ds.id === dataSourceId)?.type === 'mongodb';
}

export function buildChartPipeline(cfg: ChartConfig, gf?: GlobalFilters, coerceMongoDates = false): object[] | null {
  if (!cfg.xField) return null;
  const pipeline: object[] = [];
  const f = mergeGlobalFilters(safeJSON(cfg.queryFilter), gf, coerceMongoDates);
  if (Object.keys(f).length) pipeline.push({ $match: f });
  const configuredSeries = cfg.series?.length
    ? cfg.series
    : [{ field: cfg.yField, aggregation: cfg.aggregation, name: cfg.legendName, color: cfg.color }];
  const group: Record<string, any> = { _id: `$${cfg.xField}` };
  configuredSeries.forEach((series, index) => {
    const aggregation = series.aggregation || cfg.aggregation || 'sum';
    const accOp = aggregation === 'count' ? '$sum' : `$${aggregation}`;
    const accVal = aggregation === 'count' ? 1 : `$${series.field}`;
    group[`series_${index}`] = { [accOp]: accVal };
  });
  pipeline.push({ $group: group });
  pipeline.push({ $sort: { _id: 1 } });
  return pipeline;
}

export function buildMetricPipeline(cfg: KPIConfig | StatCardConfig | GaugeConfig, gf?: GlobalFilters, coerceMongoDates = false): object[] {
  const pipeline: object[] = [];
  const f = mergeGlobalFilters(safeJSON((cfg as any).queryFilter || '{}'), gf, coerceMongoDates);
  if (Object.keys(f).length) pipeline.push({ $match: f });
  const accOp = cfg.aggregation === 'count' ? '$sum' : `$${cfg.aggregation}`;
  const accVal = cfg.aggregation === 'count' ? 1 : `$${(cfg as KPIConfig).valueField}`;
  pipeline.push({ $group: { _id: null, value: { [accOp]: accVal } } });
  return pipeline;
}

// ---------- runtime: chooses authenticated or share-token transport ----------

export interface QueryContext {
  dataSources: DataSource[];
  dashboardId?: string;
  shareToken?: string;          // when present, route through public share endpoint
  globalFilters?: GlobalFilters;
}

async function runQuery(ctx: QueryContext, dsId: string, collection: string, opts: { queryFilter?: object; pipeline?: object[]; limit?: number }): Promise<any[]> {
  if (ctx.shareToken) {
    return shareApi.runQuery(ctx.shareToken, { dataSourceId: dsId, collection, ...opts });
  }
  const ds = ctx.dataSources.find(d => d.id === dsId);
  if (!ds) throw new Error('Data source not found');
  return queryApi.run(ctx.dashboardId
    ? { dashboardId: ctx.dashboardId, dataSourceId: dsId, collection, ...opts }
    : { dataSource: ds, collection, ...opts });
}

// ---------- query cache (per-tab, time-windowed) ----------

const CACHE_TTL_MS = 15_000;
interface CacheEntry { ts: number; data: any[]; promise?: Promise<any[]>; }
const cache = new Map<string, CacheEntry>();

function cacheKey(ctx: QueryContext, dsId: string, collection: string, payload: object): string {
  return JSON.stringify({ token: ctx.shareToken || '', dsId, collection, payload, gf: ctx.globalFilters || null });
}

export function clearQueryCache() { cache.clear(); }

async function cached(ctx: QueryContext, dsId: string, collection: string, payload: { queryFilter?: object; pipeline?: object[]; limit?: number }): Promise<any[]> {
  const key = cacheKey(ctx, dsId, collection, payload);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.data;
  if (hit?.promise) return hit.promise;
  const promise = runQuery(ctx, dsId, collection, payload);
  cache.set(key, { ts: now, data: [], promise });
  try {
    const data = await promise;
    cache.set(key, { ts: Date.now(), data });
    return data;
  } catch (e) {
    cache.delete(key);
    throw e;
  }
}

export async function fetchChartData(
  type: ChartItemType,
  cfg: ChartConfig,
  ctx: QueryContext,
): Promise<any[]> {
  if (!cfg.dataSourceId || !cfg.collection) return [];

  if (cfg.usePipeline && cfg.pipeline) {
    const p = parsePipeline(cfg.pipeline);
    if (!p) throw new Error('Invalid pipeline JSON');
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: applyGlobalFiltersToPipeline(p, ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)) });
  }
  if (type === 'scatter-chart') {
    return cached(ctx, cfg.dataSourceId, cfg.collection, {
      queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter), ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)),
      limit: 500,
    });
  }
  const pipeline = buildChartPipeline(cfg, ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId));
  if (pipeline) {
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter), ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)),
  });
}

export async function fetchMetricData(
  cfg: KPIConfig | StatCardConfig | GaugeConfig,
  ctx: QueryContext,
): Promise<any[]> {
  if (!cfg.dataSourceId || !cfg.collection) return [];

  if (cfg.usePipeline && cfg.pipeline) {
    const p = parsePipeline(cfg.pipeline);
    if (!p) throw new Error('Invalid pipeline JSON');
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: applyGlobalFiltersToPipeline(p, ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)) });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    pipeline: buildMetricPipeline(cfg, ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)),
  });
}

export async function fetchTableData(
  cfg: { dataSourceId: string; collection: string; queryFilter?: string; usePipeline?: boolean; pipeline?: string; limit?: number },
  ctx: QueryContext,
): Promise<any[]> {
  if (!cfg.dataSourceId || !cfg.collection) return [];
  if (cfg.usePipeline && cfg.pipeline) {
    const p = parsePipeline(cfg.pipeline);
    if (!p) throw new Error('Invalid pipeline JSON');
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: applyGlobalFiltersToPipeline(p, ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)) });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter || '{}'), ctx.globalFilters, isMongoSource(ctx, cfg.dataSourceId)),
    limit: cfg.limit || 50,
  });
}
