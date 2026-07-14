import { ChartConfig, KPIConfig, StatCardConfig, GaugeConfig, DataSource, ChartItemType, GlobalFilters } from '../types';
import { queryApi, shareApi } from './api';

export function safeJSON(str: string): object {
  try { return JSON.parse(str || '{}'); } catch { return {}; }
}

export function parsePipeline(str: string): object[] | null {
  try { const p = JSON.parse(str); if (Array.isArray(p)) return p; } catch { /* invalid pipelines are handled by the caller */ }
  return null;
}

function mergeGlobalFilters(base: object, gf?: GlobalFilters): object {
  if (!gf) return base;
  const merged: any = { ...base };
  if (gf.dateField && (gf.dateFrom || gf.dateTo)) {
    const range: any = {};
    if (gf.dateFrom) range.$gte = gf.dateFrom;
    if (gf.dateTo) range.$lte = gf.dateTo;
    if (Object.keys(range).length) merged[gf.dateField] = { ...(merged[gf.dateField] || {}), ...range };
  }
  return merged;
}

export function buildChartPipeline(cfg: ChartConfig, gf?: GlobalFilters): object[] | null {
  if (!cfg.xField) return null;
  const pipeline: object[] = [];
  const f = mergeGlobalFilters(safeJSON(cfg.queryFilter), gf);
  if (Object.keys(f).length) pipeline.push({ $match: f });
  const accOp = cfg.aggregation === 'count' ? '$sum' : `$${cfg.aggregation}`;
  const accVal = cfg.aggregation === 'count' ? 1 : `$${cfg.yField}`;
  pipeline.push({ $group: { _id: `$${cfg.xField}`, value: { [accOp]: accVal } } });
  pipeline.push({ $sort: { _id: 1 } });
  return pipeline;
}

export function buildMetricPipeline(cfg: KPIConfig | StatCardConfig | GaugeConfig, gf?: GlobalFilters): object[] {
  const pipeline: object[] = [];
  const f = mergeGlobalFilters(safeJSON((cfg as any).queryFilter || '{}'), gf);
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
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: p });
  }
  if (type === 'scatter-chart') {
    return cached(ctx, cfg.dataSourceId, cfg.collection, {
      queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter), ctx.globalFilters),
      limit: 500,
    });
  }
  const pipeline = buildChartPipeline(cfg, ctx.globalFilters);
  if (pipeline) {
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter), ctx.globalFilters),
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
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: p });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    pipeline: buildMetricPipeline(cfg, ctx.globalFilters),
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
    return cached(ctx, cfg.dataSourceId, cfg.collection, { pipeline: p });
  }
  return cached(ctx, cfg.dataSourceId, cfg.collection, {
    queryFilter: mergeGlobalFilters(safeJSON(cfg.queryFilter || '{}'), ctx.globalFilters),
    limit: cfg.limit || 50,
  });
}
