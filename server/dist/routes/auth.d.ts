import { Router } from 'express';
import Nedb from '@seald-io/nedb';
import { User } from '../types';
export declare function ensureAdmin(users: Nedb<User>): Promise<void>;
export declare function authRouter(users: Nedb<User>): Router;
