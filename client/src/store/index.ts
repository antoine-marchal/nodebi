import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  Dashboard, Widget, WidgetType, LayoutItem, DataSource,
  WIDGET_DEFAULTS, createDefaultConfig, GlobalFilters,
} from '../types';
import { dashboardApi } from '../services/api';
import { clearQueryCache } from '../services/widgetData';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type ThemeMode = 'light' | 'dark' | 'system';

const HISTORY_LIMIT = 50;

interface DashboardStore {
  dashboard: Dashboard;
  selectedWidgetId: string | null;
  isEditMode: boolean;
  isSaving: boolean;
  isDirty: boolean;
  themeMode: ThemeMode;
  systemDark: boolean;
  autoSaveEnabled: boolean;
  autoSaveStatus: AutoSaveStatus;
  past: Dashboard[];
  future: Dashboard[];
  shareToken?: string;
  authToken: string;
  draggedWidgetType: WidgetType | null;

  setDraggedWidgetType: (t: WidgetType | null) => void;
  addWidgetAt: (type: WidgetType, x: number, y: number) => void;
  setDashboard: (d: Dashboard) => void;
  setShareToken: (t: string | undefined) => void;
  setAuthToken: (t: string) => void;
  updateMeta: (patch: Partial<Pick<Dashboard, 'name' | 'description' | 'tags' | 'namespaceId'>>) => void;
  setGlobalFilters: (f: GlobalFilters) => void;
  addWidget: (type: WidgetType) => void;
  duplicateWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<Widget>) => void;
  updateLayout: (layout: LayoutItem[]) => void;
  selectWidget: (id: string | null) => void;
  setEditMode: (v: boolean) => void;
  addDataSource: (ds: DataSource) => void;
  updateDataSource: (id: string, patch: Partial<DataSource>) => void;
  removeDataSource: (id: string) => void;
  save: () => Promise<void>;
  exportJSON: () => void;
  importJSON: (d: Dashboard) => void;
  newDashboard: () => void;
  toggleTheme: () => void;
  setThemeMode: (m: ThemeMode) => void;
  toggleAutoSave: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  applyDrilldown: (field: string, value: any) => void;
  clearDrilldown: () => void;
}

const empty = (): Dashboard => ({
  name: 'Untitled Dashboard',
  description: '',
  tags: [],
  dataSources: [],
  widgets: [],
  layout: [],
  namespaceId: 'default',
});

const savedTheme = (localStorage.getItem('nodebi-theme') as ThemeMode) || 'system';
const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const savedAuthToken = localStorage.getItem('nodebi-auth-token') || '';

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAutoSave() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
}

export const useDashboardStore = create<DashboardStore>((set, get) => {
  const scheduleAutoSave = () => {
    if (!get().autoSaveEnabled) return;
    cancelAutoSave();
    set({ autoSaveStatus: 'pending' });
    autoSaveTimer = setTimeout(async () => {
      const state = get();
      if (!state.isDirty || !state.autoSaveEnabled) { set({ autoSaveStatus: 'idle' }); return; }
      set({ autoSaveStatus: 'saving' });
      try {
        const d = state.dashboard;
        const saved = d._id
          ? await dashboardApi.update(d._id, d)
          : await dashboardApi.create(d);
        set({ dashboard: saved, isDirty: false, autoSaveStatus: 'saved' });
        if (!d._id && saved._id) {
          window.history.replaceState({}, '', `/designer/${saved._id}`);
        }
        setTimeout(() => set(s => s.autoSaveStatus === 'saved' ? { autoSaveStatus: 'idle' } : s), 3000);
      } catch {
        set({ autoSaveStatus: 'error' });
        setTimeout(() => set({ autoSaveStatus: 'idle' }), 4000);
      }
    }, 2000);
  };

  // push current snapshot onto history before mutation
  const dirty = (fn: (s: DashboardStore) => Partial<DashboardStore>, skipHistory = false) => {
    set(s => {
      const past = skipHistory ? s.past : [...s.past.slice(-HISTORY_LIMIT + 1), s.dashboard];
      return { ...fn(s), past, future: [], isDirty: true };
    });
    scheduleAutoSave();
  };

  // Listen to system theme
  if (typeof window !== 'undefined' && window.matchMedia) {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    m.addEventListener?.('change', e => set({ systemDark: e.matches }));
  }

  return {
    dashboard: empty(),
    selectedWidgetId: null,
    isEditMode: true,
    isSaving: false,
    isDirty: false,
    themeMode: savedTheme,
    systemDark,
    autoSaveEnabled: true,
    autoSaveStatus: 'idle',
    past: [],
    future: [],
    authToken: savedAuthToken,
    shareToken: undefined,
    draggedWidgetType: null,

    setDraggedWidgetType: (t) => set({ draggedWidgetType: t }),

    addWidgetAt: (type, x, y) => {
      const id = uuidv4();
      const defaults = WIDGET_DEFAULTS[type];
      const widget: Widget = {
        id, type,
        title: type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        config: createDefaultConfig(type),
      };
      const layout: LayoutItem = { i: id, x, y, ...defaults };
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          widgets: [...s.dashboard.widgets, widget],
          layout: [...s.dashboard.layout, layout],
        },
        selectedWidgetId: id,
      }));
    },

    setDashboard: (d) => {
      cancelAutoSave();
      clearQueryCache();
      set({ dashboard: d, isDirty: false, selectedWidgetId: null, autoSaveStatus: 'idle', past: [], future: [] });
    },

    setShareToken: (t) => set({ shareToken: t }),
    setAuthToken: (t) => { localStorage.setItem('nodebi-auth-token', t); set({ authToken: t }); },

    updateMeta: (patch) =>
      dirty(s => ({ dashboard: { ...s.dashboard, ...patch } })),

    setGlobalFilters: (f) => {
      clearQueryCache();
      dirty(s => ({ dashboard: { ...s.dashboard, globalFilters: f } }));
    },

    addWidget: (type) => {
      const id = uuidv4();
      const defaults = WIDGET_DEFAULTS[type];
      const widget: Widget = {
        id, type,
        title: type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        config: createDefaultConfig(type),
      };
      const layout: LayoutItem = { i: id, x: 0, y: Infinity, ...defaults };
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          widgets: [...s.dashboard.widgets, widget],
          layout: [...s.dashboard.layout, layout],
        },
        selectedWidgetId: id,
      }));
    },

    duplicateWidget: (id) => {
      const state = get();
      const w = state.dashboard.widgets.find(x => x.id === id);
      const l = state.dashboard.layout.find(x => x.i === id);
      if (!w) return;
      const newId = uuidv4();
      const newW: Widget = { ...w, id: newId, title: `${w.title} (copy)`, config: JSON.parse(JSON.stringify(w.config)) };
      const newL: LayoutItem = l ? { ...l, i: newId, x: (l.x + l.w) % 12, y: l.y } : { i: newId, x: 0, y: Infinity, ...WIDGET_DEFAULTS[w.type] };
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          widgets: [...s.dashboard.widgets, newW],
          layout: [...s.dashboard.layout, newL],
        },
        selectedWidgetId: newId,
      }));
    },

    removeWidget: (id) =>
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          widgets: s.dashboard.widgets.filter(w => w.id !== id),
          layout: s.dashboard.layout.filter(l => l.i !== id),
        },
        selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
      })),

    updateWidget: (id, patch) =>
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          widgets: s.dashboard.widgets.map(w => w.id === id ? { ...w, ...patch } : w),
        },
      })),

    updateLayout: (layout) =>
      dirty(s => ({ dashboard: { ...s.dashboard, layout } }), true),

    selectWidget: (id) => set({ selectedWidgetId: id }),
    setEditMode: (v) => set({ isEditMode: v }),

    addDataSource: (ds) =>
      dirty(s => ({ dashboard: { ...s.dashboard, dataSources: [...s.dashboard.dataSources, ds] } })),

    updateDataSource: (id, patch) =>
      dirty(s => ({
        dashboard: {
          ...s.dashboard,
          dataSources: s.dashboard.dataSources.map(ds => ds.id === id ? { ...ds, ...patch } : ds),
        },
      })),

    removeDataSource: (id) =>
      dirty(s => ({
        dashboard: { ...s.dashboard, dataSources: s.dashboard.dataSources.filter(ds => ds.id !== id) },
      })),

    save: async () => {
      cancelAutoSave();
      const { dashboard } = get();
      set({ isSaving: true, autoSaveStatus: 'saving' });
      try {
        const saved = dashboard._id
          ? await dashboardApi.update(dashboard._id, dashboard)
          : await dashboardApi.create(dashboard);
        set({ dashboard: saved, isSaving: false, isDirty: false, autoSaveStatus: 'saved' });
        setTimeout(() => set(s => s.autoSaveStatus === 'saved' ? { autoSaveStatus: 'idle' } : s), 2000);
      } catch (e) {
        set({ isSaving: false, autoSaveStatus: 'error' });
        throw e;
      }
    },

    exportJSON: () => {
      const { dashboard } = get();
      // strip _id and server-side __stored__ marker so the file is portable + sanitised
      const out = JSON.parse(JSON.stringify(dashboard));
      delete out._id;
      out.dataSources = (out.dataSources || []).map((ds: DataSource) =>
        ds.type === 'mongodb' && ds.mongoUri === '__stored__' ? { ...ds, mongoUri: '' } : ds);
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importJSON: (d) => {
      cancelAutoSave();
      clearQueryCache();
      const clean = { ...d };
      delete clean._id;
      set({ dashboard: clean, isDirty: true, selectedWidgetId: null, past: [], future: [], autoSaveStatus: 'idle' });
      scheduleAutoSave();
    },

    newDashboard: () => {
      cancelAutoSave();
      clearQueryCache();
      set({ dashboard: empty(), isDirty: false, selectedWidgetId: null, autoSaveStatus: 'idle', past: [], future: [] });
    },

    toggleTheme: () =>
      set(s => {
        const order: ThemeMode[] = ['light', 'dark', 'system'];
        const next = order[(order.indexOf(s.themeMode) + 1) % order.length];
        localStorage.setItem('nodebi-theme', next);
        return { themeMode: next };
      }),

    setThemeMode: (m) => { localStorage.setItem('nodebi-theme', m); set({ themeMode: m }); },

    toggleAutoSave: () => set(s => ({ autoSaveEnabled: !s.autoSaveEnabled })),

    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      cancelAutoSave();
      set({
        past: s.past.slice(0, -1),
        future: [s.dashboard, ...s.future],
        dashboard: prev,
        isDirty: true,
      });
      scheduleAutoSave();
    },

    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const next = s.future[0];
      cancelAutoSave();
      set({
        past: [...s.past, s.dashboard],
        future: s.future.slice(1),
        dashboard: next,
        isDirty: true,
      });
      scheduleAutoSave();
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    applyDrilldown: (field, value) => {
      const s = get();
      const gf = s.dashboard.globalFilters || {};
      const next: GlobalFilters = { ...gf, search: JSON.stringify({ [field]: value }) };
      clearQueryCache();
      // In shared/view-only mode, treat as transient filter (no persistence)
      if (s.shareToken) {
        set({ dashboard: { ...s.dashboard, globalFilters: next } });
        return;
      }
      set({ dashboard: { ...s.dashboard, globalFilters: next }, isDirty: true });
      scheduleAutoSave();
    },

    clearDrilldown: () => {
      const s = get();
      const gf = { ...(s.dashboard.globalFilters || {}) };
      delete gf.search;
      clearQueryCache();
      if (s.shareToken) {
        set({ dashboard: { ...s.dashboard, globalFilters: gf } });
        return;
      }
      set({ dashboard: { ...s.dashboard, globalFilters: gf }, isDirty: true });
      scheduleAutoSave();
    },
  };
});

// Effective dark-mode selector
export function useEffectiveDark(): boolean {
  const mode = useDashboardStore(s => s.themeMode);
  const sysDark = useDashboardStore(s => s.systemDark);
  if (mode === 'system') return sysDark;
  return mode === 'dark';
}
