import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ProductMark from '../components/common/ProductMark';
import { authApi } from '../services/api';
import { setSession } from '../auth';

export default function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const exchange = async () => {
      try {
        const cfg = await authApi.proxyConfig(); if (!cfg.enabled) return;
        const ticket = new URLSearchParams(window.location.search).get(cfg.paramName); if (!ticket) return;
        setLoading(true); const result = await authApi.proxyLogin(cfg.paramName, ticket);
        setSession(result.accessToken, result.user); navigate('/', { replace: true });
      } catch (e: any) { setError(e?.response?.data?.error || 'Proxy authentication failed'); setLoading(false); }
    }; void exchange();
  }, [navigate]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try { const result = await authApi.login(login, password); setSession(result.accessToken, result.user); navigate('/', { replace: true }); }
    catch (e: any) { setError(e?.response?.data?.error || 'Login failed'); } finally { setLoading(false); }
  };
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
    <Paper component="form" onSubmit={submit} sx={{ width: '100%', maxWidth: 400, p: 4 }}>
      <Stack spacing={2.5}><ProductMark /><Box><Typography variant="h5">Sign in</Typography><Typography color="text.secondary">Use your NodeBI account to continue.</Typography></Box>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Login" autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} required autoFocus />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? <CircularProgress size={22} /> : 'Sign in'}</Button>
      </Stack>
    </Paper>
  </Box>;
}
