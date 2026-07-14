"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeDataSourceSecret = storeDataSourceSecret;
exports.getDataSourceSecret = getDataSourceSecret;
exports.removeDataSourceSecret = removeDataSourceSecret;
exports.hydrate = hydrate;
exports.stripSecrets = stripSecrets;
exports.extractAndPersist = extractAndPersist;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
if (!fs_1.default.existsSync(config_1.SECRETS_DIR))
    fs_1.default.mkdirSync(config_1.SECRETS_DIR, { recursive: true });
const file = path_1.default.join(config_1.SECRETS_DIR, 'datasource-secrets.json');
function readAll() {
    try {
        return JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
    }
    catch {
        return {};
    }
}
function writeAll(data) {
    fs_1.default.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
function storeDataSourceSecret(id, secret) {
    const all = readAll();
    all[id] = { ...all[id], ...secret };
    writeAll(all);
}
function getDataSourceSecret(id) {
    return readAll()[id];
}
function removeDataSourceSecret(id) {
    const all = readAll();
    delete all[id];
    writeAll(all);
}
// Server hydrates secret back onto data source before use
function hydrate(ds) {
    if (ds.type !== 'mongodb')
        return ds;
    const placeholder = !ds.mongoUri || ds.mongoUri === '__stored__';
    if (!placeholder)
        return ds;
    const sec = getDataSourceSecret(ds.id);
    if (sec?.mongoUri)
        return { ...ds, mongoUri: sec.mongoUri };
    return ds;
}
// Strip secret before returning to client / export
function stripSecrets(doc) {
    if (!doc?.dataSources)
        return doc;
    return {
        ...doc,
        dataSources: doc.dataSources.map(ds => ds.type === 'mongodb'
            ? { ...ds, mongoUri: ds.mongoUri ? '__stored__' : '' }
            : ds),
    };
}
// Persist any secret values present on incoming dashboard, return doc with placeholder
function extractAndPersist(doc) {
    if (!doc?.dataSources)
        return doc;
    const cleaned = doc.dataSources.map(ds => {
        if (ds.type !== 'mongodb')
            return ds;
        if (ds.mongoUri && ds.mongoUri !== '__stored__') {
            storeDataSourceSecret(ds.id, { mongoUri: ds.mongoUri });
            return { ...ds, mongoUri: '__stored__' };
        }
        return ds;
    });
    return { ...doc, dataSources: cleaned };
}
