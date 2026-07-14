import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Typography,
  Divider, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { v4 as uuidv4 } from 'uuid';
import { DataSource, DbType } from '../../types';
import { useDashboardStore } from '../../store';
import { queryApi } from '../../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

const empty = (): Omit<DataSource, 'id'> => ({ name: '', type: 'nedb', nedbPath: '', mongoUri: '', mongoDatabase: '' });

export default function DataSourceDialog({ open, onClose }: Props) {
  const { dashboard, addDataSource, removeDataSource } = useDashboardStore();
  const [form, setForm] = useState(empty());
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const handleTest = async () => {
    setTesting(true); setTestMsg(''); setTestOk(null);
    try {
      const ds: DataSource = { id: '__test__', ...form };
      const cols = await queryApi.collections(ds);
      setTestMsg(`Connected. Found ${cols.length} collection(s): ${cols.join(', ') || '(none)'}`);
      setTestOk(true);
    } catch (e: any) {
      setTestMsg(e.response?.data?.error || e.message);
      setTestOk(false);
    } finally { setTesting(false); }
  };

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addDataSource({ id: uuidv4(), ...form });
    setForm(empty()); setTestMsg(''); setTestOk(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Data Sources</DialogTitle>
      <DialogContent dividers>
        {dashboard.dataSources.length > 0 && (
          <>
            <List dense>
              {dashboard.dataSources.map(ds => {
                const secretStored = ds.type === 'mongodb' && ds.mongoUri === '__stored__';
                return (
                  <ListItem key={ds.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={ds.name}
                      secondary={ds.type === 'nedb'
                        ? `NeDB • ${ds.nedbPath || 'default path'}`
                        : `MongoDB • ${ds.mongoDatabase} ${secretStored ? '• URI stored server-side' : ''}`}
                    />
                    <ListItemSecondaryAction>
                      <Chip label={ds.type} size="small" color={ds.type === 'mongodb' ? 'success' : 'info'} sx={{ mr: 1 }} />
                      <IconButton edge="end" size="small" color="error" onClick={() => removeDataSource(ds.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        <Typography variant="subtitle2" gutterBottom>Add Data Source</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Name" value={form.name} onChange={e => set({ name: e.target.value })} size="small" sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={e => set({ type: e.target.value as DbType })}>
                <MenuItem value="nedb">NeDB</MenuItem>
                <MenuItem value="mongodb">MongoDB</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {form.type === 'nedb' && (
            <TextField label="Data path (relative to server data/user/)"
              value={form.nedbPath || ''} onChange={e => set({ nedbPath: e.target.value })}
              size="small" fullWidth
              helperText="Empty = default user data directory. Absolute paths blocked for safety." />
          )}

          {form.type === 'mongodb' && (
            <>
              <TextField label="MongoDB URI" value={form.mongoUri || ''} onChange={e => set({ mongoUri: e.target.value })}
                size="small" fullWidth placeholder="mongodb://localhost:27017"
                helperText="Stored server-side after save; never sent back to clients." />
              <TextField label="Database name" value={form.mongoDatabase || ''} onChange={e => set({ mongoDatabase: e.target.value })} size="small" fullWidth />
            </>
          )}

          {testMsg && <Alert severity={testOk ? 'success' : 'error'} icon={testOk ? <CheckCircleIcon /> : undefined}>{testMsg}</Alert>}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={handleTest} disabled={testing || !form.name}>
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd} disabled={!form.name.trim()}>Add</Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
