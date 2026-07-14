"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToken = createToken;
exports.verifyToken = verifyToken;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./config");
function b64(s) {
    return Buffer.from(s).toString('base64url');
}
function sign(payload) {
    return crypto_1.default.createHmac('sha256', config_1.SHARE_SECRET).update(payload).digest('base64url');
}
function createToken(p) {
    const body = b64(JSON.stringify(p));
    const sig = sign(body);
    return `${body}.${sig}`;
}
function verifyToken(token) {
    if (!token || token.indexOf('.') === -1)
        return null;
    const [body, sig] = token.split('.');
    const expected = Buffer.from(sign(body));
    const actual = Buffer.from(sig || '');
    if (expected.length !== actual.length || !crypto_1.default.timingSafeEqual(expected, actual))
        return null;
    try {
        const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
        if (p.exp && Date.now() / 1000 > p.exp)
            return null;
        return p;
    }
    catch {
        return null;
    }
}
