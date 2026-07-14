import { useEffect, useState } from 'react';
import { User } from './types';

const TOKEN_KEY = 'nodebi-auth-token';
const USER_KEY = 'nodebi-user';
const EVENT = 'nodebi-auth-change';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const getUser = (): User | null => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};
export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(EVENT));
}
export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getUser());
  useEffect(() => { const update = () => setUser(getUser()); window.addEventListener(EVENT, update); return () => window.removeEventListener(EVENT, update); }, []);
  return { user, isAdmin: user?.role === 'admin', canCreate: user?.role === 'admin' || user?.role === 'operator', logout: clearSession };
}
