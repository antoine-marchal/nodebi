"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_DIST = exports.PROD = exports.MAX_RESPONSE_ROWS = exports.ENABLE_SEED = exports.SHARE_SECRET = exports.PROXYAUTH_REGEX = exports.PROXYAUTH_LOGIN_URL = exports.PROXYAUTH_URL = exports.PROXYAUTH_NAME = exports.PUBLIC_URL = exports.ADMIN_PASSWORD = exports.ADMIN_LOGIN = exports.JWT_SECRET = exports.AUTH_TOKEN = exports.ALLOWED_ORIGIN = exports.SECRETS_DIR = exports.USER_DATA_DIR = exports.DATA_DIR = exports.PORT = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// npm --prefix runs server scripts with server/ as cwd; always load the project-level file first.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '..', '.env') });
dotenv_1.default.config();
exports.PORT = Number(process.env.PORT) || 3001;
exports.DATA_DIR = process.env.DATA_DIR
    ? path_1.default.resolve(process.env.DATA_DIR)
    : path_1.default.join(__dirname, '..', 'data');
exports.USER_DATA_DIR = path_1.default.join(exports.DATA_DIR, 'user');
exports.SECRETS_DIR = path_1.default.join(exports.DATA_DIR, 'secrets');
exports.ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
exports.AUTH_TOKEN = process.env.AUTH_TOKEN || '';
exports.JWT_SECRET = process.env.JWT_SECRET || 'nodebi-development-jwt-secret';
exports.ADMIN_LOGIN = (process.env.ADMIN_LOGIN || 'admin').toLowerCase();
exports.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
exports.PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${exports.PORT}`).replace(/\/$/, '');
exports.PROXYAUTH_NAME = process.env.NODEBI_PROXYAUTH_NAME || 'ticket';
exports.PROXYAUTH_URL = process.env.NODEBI_PROXYAUTH_URL || '';
exports.PROXYAUTH_LOGIN_URL = process.env.NODEBI_PROXYAUTH_LOGIN_URL
    || exports.PROXYAUTH_URL.replace(/\/validate\/?$/i, '/login');
exports.PROXYAUTH_REGEX = process.env.NODEBI_PROXYAUTH_REGEX || '';
exports.SHARE_SECRET = process.env.SHARE_SECRET || 'change-me-share-secret';
exports.ENABLE_SEED = process.env.ENABLE_SEED === 'true';
exports.MAX_RESPONSE_ROWS = Number(process.env.MAX_RESPONSE_ROWS) || 10000;
exports.PROD = process.env.NODE_ENV === 'production';
exports.CLIENT_DIST = process.env.CLIENT_DIST
    ? path_1.default.resolve(process.env.CLIENT_DIST)
    : path_1.default.join(__dirname, '..', '..', 'client', 'dist');
if (exports.PROD) {
    const unsafe = [
        !process.env.JWT_SECRET || ['nodebi-development-jwt-secret', 'replace-with-at-least-32-random-bytes'].includes(exports.JWT_SECRET) ? 'JWT_SECRET' : '',
        !process.env.ADMIN_PASSWORD || ['admin', 'change-this-on-first-start'].includes(exports.ADMIN_PASSWORD) ? 'ADMIN_PASSWORD' : '',
        !process.env.SHARE_SECRET || ['change-me-share-secret', 'replace-with-32-byte-random'].includes(exports.SHARE_SECRET) ? 'SHARE_SECRET' : '',
    ].filter(Boolean);
    if (unsafe.length)
        throw new Error(`Refusing to start in production with unsafe configuration: ${unsafe.join(', ')}`);
}
