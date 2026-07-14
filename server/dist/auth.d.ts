import { Request, Response, NextFunction } from 'express';
import Nedb from '@seald-io/nedb';
import { Role, User } from './types';
export interface AuthUser {
    _id: string;
    login: string;
    role: Role;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare function createAccessToken(user: Pick<User, '_id' | 'login' | 'role'>): string;
export declare function requireRole(...roles: Role[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function authMiddleware(users: Nedb<User>): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
