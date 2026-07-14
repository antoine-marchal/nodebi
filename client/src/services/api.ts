import axios from 'axios';
import { Dashboard, DataSource, Namespace, Role, User } from '../types';
import { clearSession } from '../auth';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const tok = localStorage.getItem('nodebi-auth-token');
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});
api.interceptors.response.use(response => response, error => {
  if (error?.response?.status === 401 && !String(error?.config?.url || '').includes('/auth/')) {
    clearSession(); if (!window.location.pathname.startsWith('/shared/')) window.location.assign('/login');
  }
  return Promise.reject(error);
});

export const authApi = {
  login: (login: string, password: string) => api.post<{ accessToken: string; user: User }>('/auth/login', { login, password }).then(r => r.data),
  me: () => api.get<User>('/auth/me').then(r => r.data),
  proxyConfig: () => api.get<{ enabled: boolean; paramName: string; loginUrl?: string; service?: string }>('/auth-proxy/config').then(r => r.data),
  proxyLogin: (paramName: string, ticket: string) => api.get<{ accessToken: string; user: User }>('/auth-proxy', { params: { [paramName]: ticket } }).then(r => r.data),
};

export const usersApi = {
  list: () => api.get<User[]>('/users').then(r => r.data),
  create: (body: { login: string; password?: string; role: Role }) => api.post<User>('/users', body).then(r => r.data),
  update: (id: string, body: { password?: string; role?: Role }) => api.patch<User>(`/users/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/users/${id}`).then(r => r.data),
};

export const namespaceApi = {
  list: () => api.get<Namespace[]>('/namespaces').then(r => r.data),
  create: (body: Omit<Namespace, '_id'>) => api.post<Namespace>('/namespaces', body).then(r => r.data),
  update: (id: string, body: Partial<Namespace>) => api.put<Namespace>(`/namespaces/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/namespaces/${id}`).then(r => r.data),
};

export const dashboardApi = {
  list: () => api.get<Dashboard[]>('/dashboards').then(r => r.data),
  get: (id: string) => api.get<Dashboard>(`/dashboards/${id}`).then(r => r.data),
  create: (d: Omit<Dashboard, '_id'>) => api.post<Dashboard>('/dashboards', d).then(r => r.data),
  update: (id: string, d: Partial<Dashboard>) => api.put<Dashboard>(`/dashboards/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/dashboards/${id}`).then(r => r.data),
  revisions: (id: string) => api.get<{ _id: string; createdAt: string }[]>(`/dashboards/${id}/revisions`).then(r => r.data),
  restoreRevision: (id: string, revId: string) =>
    api.post<Dashboard>(`/dashboards/${id}/revisions/${revId}/restore`).then(r => r.data),
};

export const queryApi = {
  run: (payload: {
    dataSource?: DataSource;
    dashboardId?: string;
    dataSourceId?: string;
    collection: string;
    queryFilter?: object;
    pipeline?: object[];
    limit?: number;
  }) => api.post<any[]>('/query', payload).then(r => r.data),

  collections: (dataSource: DataSource) =>
    api.post<string[]>('/query/collections', dataSource).then(r => r.data),

  sample: (dataSource: DataSource, collection: string) =>
    api.post<any>('/query/sample', { dataSource, collection }).then(r => r.data),

  seed: (collection: string, records: object[]) =>
    api.post('/query/seed', { collection, records }).then(r => r.data),
};

export const shareApi = {
  create: (id: string, ttlDays?: number) =>
    api.post<{ token: string }>(`/share/create/${id}`, { ttlDays }).then(r => r.data),
  getDashboard: (token: string) =>
    api.get<Dashboard>(`/share/dashboard/${token}`).then(r => r.data),
  runQuery: (token: string, payload: {
    dataSourceId: string; collection: string; queryFilter?: object; pipeline?: object[]; limit?: number;
  }) => api.post<any[]>(`/share/query/${token}`, payload).then(r => r.data),
};
