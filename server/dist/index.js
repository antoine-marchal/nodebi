"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dashboards_1 = require("./routes/dashboards");
const query_1 = require("./routes/query");
const share_1 = require("./routes/share");
const auth_1 = require("./routes/auth");
const namespaces_1 = require("./routes/namespaces");
const nedb_1 = __importDefault(require("@seald-io/nedb"));
const auth_2 = require("./auth");
const mongo_adapter_1 = require("./db/mongo-adapter");
const config_1 = require("./config");
[config_1.DATA_DIR, config_1.USER_DATA_DIR, config_1.SECRETS_DIR].forEach(d => {
    if (!fs_1.default.existsSync(d))
        fs_1.default.mkdirSync(d, { recursive: true });
});
const dashboardDb = new nedb_1.default({ filename: path_1.default.join(config_1.DATA_DIR, 'dashboards.db'), autoload: true });
const usersDb = new nedb_1.default({ filename: path_1.default.join(config_1.DATA_DIR, 'users.db'), autoload: true });
const namespacesDb = new nedb_1.default({ filename: path_1.default.join(config_1.DATA_DIR, 'namespaces.db'), autoload: true });
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: config_1.ALLOWED_ORIGIN === '*' ? true : config_1.ALLOWED_ORIGIN.split(',').map(s => s.trim()) }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use('/api', (0, express_rate_limit_1.default)({ windowMs: 60000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api', (0, auth_2.authMiddleware)(usersDb));
app.use('/api', (0, auth_1.authRouter)(usersDb));
app.use('/api/namespaces', (0, namespaces_1.namespacesRouter)(namespacesDb, dashboardDb));
app.use('/api/dashboards', (0, dashboards_1.dashboardsRouter)(config_1.DATA_DIR, dashboardDb, namespacesDb));
app.use('/api/query', (0, query_1.queryRouter)(dashboardDb, namespacesDb));
app.use('/api/share', (0, share_1.shareRouter)(dashboardDb, namespacesDb));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
// Serve client build in production
if (config_1.PROD && fs_1.default.existsSync(config_1.CLIENT_DIST)) {
    app.use(express_1.default.static(config_1.CLIENT_DIST));
    app.get('*', (_req, res) => res.sendFile(path_1.default.join(config_1.CLIENT_DIST, 'index.html')));
}
let server;
async function start() {
    await (0, auth_1.ensureAdmin)(usersDb);
    if (!await namespacesDb.findOneAsync({ _id: 'default' }))
        await namespacesDb.insertAsync({
            _id: 'default', name: 'Default', description: 'Visible to every authenticated user',
            allowedRoles: ['operator', 'viewer'], allowedUserIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
    server = app.listen(config_1.PORT, () => {
        console.log(`NodeBI server running on http://localhost:${config_1.PORT}`);
        console.log(`Data directory: ${config_1.DATA_DIR}`);
    });
}
void start().catch(error => { console.error('NodeBI failed to start:', error); process.exit(1); });
async function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down...`);
    server?.close();
    await (0, mongo_adapter_1.closeMongoPool)();
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
