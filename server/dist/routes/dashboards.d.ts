import { Router } from 'express';
import Nedb from '@seald-io/nedb';
import { Dashboard, Namespace } from '../types';
export declare function dashboardsRouter(dataDir: string, db: Nedb<Dashboard>, namespaces: Nedb<Namespace>): Router;
