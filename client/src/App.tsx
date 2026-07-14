import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useEffectiveDark } from './store';
import { lightTheme, darkTheme } from './theme';
import Home from './pages/Home';
import Designer from './pages/Designer';
import Viewer from './pages/Viewer';
import SharedView from './pages/SharedView';
import Login from './pages/Login';
import Admin from './pages/Admin';
import { getToken, getUser } from './auth';
import { authApi } from './services/api';

function SsoGate() {
  const [message, setMessage] = useState('Redirecting to sign in…');
  useEffect(() => { void authApi.proxyConfig().then(cfg => {
    const ticket = new URLSearchParams(window.location.search).get(cfg.paramName);
    if (ticket || !cfg.enabled || !cfg.loginUrl || !cfg.service) { window.location.replace(`/login${window.location.search}`); return; }
    const separator = cfg.loginUrl.includes('?') ? '&' : '?'; window.location.href = `${cfg.loginUrl}${separator}service=${encodeURIComponent(cfg.service)}`;
  }).catch(() => { setMessage('Opening password login…'); window.location.replace('/login'); }); }, []);
  return <div style={{ padding: 40 }}>{message}</div>;
}

function PrivateRoute({ children, admin = false }: { children: React.ReactElement; admin?: boolean }) {
  if (!getToken()) return <SsoGate />;
  if (admin && getUser()?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function ThemedApp() {
  const dark = useEffectiveDark();
  return (
    <ThemeProvider theme={dark ? darkTheme : lightTheme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/designer" element={<PrivateRoute><Designer /></PrivateRoute>} />
        <Route path="/designer/:id" element={<PrivateRoute><Designer /></PrivateRoute>} />
        <Route path="/view/:id" element={<PrivateRoute><Viewer /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute admin><Admin /></PrivateRoute>} />
        <Route path="/shared/:token" element={<SharedView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default function App() {
  return <ThemedApp />;
}
