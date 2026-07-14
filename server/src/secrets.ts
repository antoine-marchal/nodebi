import fs from 'fs';
import path from 'path';
import { SECRETS_DIR } from './config';
import { DataSource } from './types';

if (!fs.existsSync(SECRETS_DIR)) fs.mkdirSync(SECRETS_DIR, { recursive: true });

const file = path.join(SECRETS_DIR, 'datasource-secrets.json');

interface SecretRecord {
  mongoUri?: string;
}

function readAll(): Record<string, SecretRecord> {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return {}; }
}

function writeAll(data: Record<string, SecretRecord>) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function storeDataSourceSecret(id: string, secret: SecretRecord) {
  const all = readAll();
  all[id] = { ...all[id], ...secret };
  writeAll(all);
}

export function getDataSourceSecret(id: string): SecretRecord | undefined {
  return readAll()[id];
}

export function removeDataSourceSecret(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

// Server hydrates secret back onto data source before use
export function hydrate(ds: DataSource): DataSource {
  if (ds.type !== 'mongodb') return ds;
  const placeholder = !ds.mongoUri || ds.mongoUri === '__stored__';
  if (!placeholder) return ds;
  const sec = getDataSourceSecret(ds.id);
  if (sec?.mongoUri) return { ...ds, mongoUri: sec.mongoUri };
  return ds;
}

// Strip secret before returning to client / export
export function stripSecrets<T extends { dataSources?: DataSource[] }>(doc: T): T {
  if (!doc?.dataSources) return doc;
  return {
    ...doc,
    dataSources: doc.dataSources.map(ds => ds.type === 'mongodb'
      ? { ...ds, mongoUri: ds.mongoUri ? '__stored__' : '' }
      : ds),
  };
}

// Persist any secret values present on incoming dashboard, return doc with placeholder
export function extractAndPersist<T extends { _id?: string; dataSources?: DataSource[] }>(doc: T): T {
  if (!doc?.dataSources) return doc;
  const cleaned = doc.dataSources.map(ds => {
    if (ds.type !== 'mongodb') return ds;
    if (ds.mongoUri && ds.mongoUri !== '__stored__') {
      storeDataSourceSecret(ds.id, { mongoUri: ds.mongoUri });
      return { ...ds, mongoUri: '__stored__' };
    }
    return ds;
  });
  return { ...doc, dataSources: cleaned };
}
