import { Router } from 'express';
import Nedb from '@seald-io/nedb';
import { Dashboard, Namespace } from '../types';
export declare function namespacesRouter(db: Nedb<Namespace>, dashboards: Nedb<Dashboard>): Router;
